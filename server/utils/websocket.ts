import { WebSocket, WebSocketServer } from 'ws';
import { type Server } from 'http';
import { type Request } from 'express';
import { db } from '@db';
import { notifications, type SelectUser } from '@db/schema';
import { eq } from 'drizzle-orm';

// Extend WebSocket interface to include user data and connection status
interface WebSocketConnection extends WebSocket {
  userId?: number;
  isAlive: boolean;
  sessionId: string;
}

// Extend Request to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: SelectUser;
  sessionID?: string;
}

class NotificationServer {
  private wss: WebSocketServer;
  private clients: Map<number, Set<WebSocketConnection>>;
  private heartbeatInterval: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT = 120000; // 2 minutes

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/notifications',
      verifyClient: (info: any, callback: any) => this.verifyClient(info, callback)
    });
    this.clients = new Map();

    // Setup WebSocket server event handlers
    this.wss.on('connection', this.handleConnection.bind(this));

    // Setup heartbeat interval
    this.heartbeatInterval = setInterval(this.checkConnections.bind(this), this.HEARTBEAT_INTERVAL);

    console.log('WebSocket notification server initialized');
  }

  private verifyClient(
    info: { req: Request & { user?: SelectUser; sessionID?: string } },
    callback: (verified: boolean, code?: number, message?: string) => void
  ) {
    try {
      const user = info.req.user;
      if (!user) {
        console.log('Unauthorized WebSocket connection attempt');
        callback(false, 401, 'Unauthorized');
        return;
      }

      callback(true);
    } catch (error) {
      console.error('Error during WebSocket authentication:', error);
      callback(false, 500, 'Internal Server Error');
    }
  }

  private checkConnections() {
    this.wss.clients.forEach((ws: WebSocket) => {
      const connection = ws as WebSocketConnection;
      if (!connection.isAlive) {
        console.log(`Terminating inactive connection for user ${connection.userId}`);
        return connection.terminate();
      }

      connection.isAlive = false;
      connection.ping();
    });
  }

  private handleConnection(ws: WebSocket, req: Request & { user?: SelectUser; sessionID?: string }) {
    const connection = ws as WebSocketConnection;
    const userId = req.user?.id;
    if (!userId) {
      connection.close(1008, 'User ID not found');
      return;
    }

    // Initialize connection properties
    connection.userId = userId;
    connection.isAlive = true;
    connection.sessionId = req.sessionID || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add to clients map
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)?.add(connection);

    console.log(`New WebSocket connection established for user ${userId} with session ${connection.sessionId}`);

    // Setup connection event handlers
    connection.on('pong', () => {
      connection.isAlive = true;
    });

    connection.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });

    connection.on('close', () => {
      this.handleDisconnect(connection);
    });

    // Send pending notifications on connection
    this.sendPendingNotifications(userId, connection);
  }

  private handleDisconnect(ws: WebSocketConnection) {
    if (ws.userId && this.clients.has(ws.userId)) {
      const userConnections = this.clients.get(ws.userId);
      userConnections?.delete(ws);

      if (userConnections?.size === 0) {
        this.clients.delete(ws.userId);
      }

      console.log(`WebSocket connection closed for user ${ws.userId} session ${ws.sessionId}`);
    }
  }

  private async sendPendingNotifications(userId: number, ws: WebSocketConnection) {
    try {
      const pendingNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .where(eq(notifications.isRead, false));

      if (pendingNotifications.length > 0) {
        ws.send(JSON.stringify({
          type: 'pending_notifications',
          data: pendingNotifications
        }));
        console.log(`Sent ${pendingNotifications.length} pending notifications to user ${userId}`);
      }
    } catch (error) {
      console.error(`Error fetching pending notifications for user ${userId}:`, error);
    }
  }

  public broadcastToUser(userId: number, notification: any) {
    const userConnections = this.clients.get(userId);
    if (!userConnections) return;

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    userConnections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public broadcastToAll(notification: any) {
    const message = JSON.stringify({
      type: 'broadcast',
      data: notification
    });

    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public getActiveConnections(): Map<number, number> {
    const connections = new Map<number, number>();
    this.clients.forEach((userConnections, userId) => {
      connections.set(userId, userConnections.size);
    });
    return connections;
  }

  public shutdown() {
    clearInterval(this.heartbeatInterval);

    // Close all connections gracefully
    this.wss.clients.forEach((client: WebSocket) => {
      client.close(1000, 'Server shutting down');
    });

    this.wss.close();
    console.log('WebSocket notification server shut down');
  }
}

// Singleton instance
let notificationServer: NotificationServer | null = null;

export function setupWebSocketServer(server: Server): NotificationServer {
  if (!notificationServer) {
    notificationServer = new NotificationServer(server);
  }
  return notificationServer;
}

export function getNotificationServer(): NotificationServer | null {
  return notificationServer;
}