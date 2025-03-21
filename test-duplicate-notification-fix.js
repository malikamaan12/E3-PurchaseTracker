/**
 * Test script to verify the notification deduplication fix
 * 
 * This script runs a direct comparison between notifications 
 * created before and after a sequence of status transitions
 * to verify that we've eliminated duplicates.
 */

const { db } = require('./db');
const { eq, ne, and, or, desc, sql } = require('drizzle-orm');
const { notifications, users, purchaseRequests, approvals } = require('./db/schema');

async function testNotificationFixing() {
  console.log('Starting notification fix verification test...');
  
  try {
    // Step 1: Count the total notifications in the database
    const [{ count: initialCount }] = await db.select({
      count: sql`count(*)`.mapWith(Number)
    }).from(notifications);
    
    console.log(`Initial notification count: ${initialCount}`);
    
    // Step 2: Generate a sample request with a unique title for tracking
    const testTitle = `Test Request ${Date.now()}`;
    console.log(`Creating test request with title: ${testTitle}`);
    
    // Find a test user to use as requester
    const [testUser] = await db.select().from(users).limit(1);
    
    if (!testUser) {
      console.error('No test user found in the database');
      return;
    }
    
    // Create a test request
    const [testRequest] = await db.insert(purchaseRequests)
      .values({
        title: testTitle,
        description: 'Test request for notification fix verification',
        requesterId: testUser.id,
        status: 'draft',
        requestNumber: `TST-${Date.now()}`,
        priority: 'medium',
        purposeType: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [{ name: 'Test item', quantity: 1, estimatedCost: 100 }],
        totalEstimatedCost: 100
      })
      .returning();
    
    console.log(`Created test request with ID ${testRequest.id}`);
    
    // Wait a moment to ensure database propagation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Change the status to pending (this should trigger notifications)
    await db.update(purchaseRequests)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(purchaseRequests.id, testRequest.id));
    
    console.log('Changed request status to pending');
    
    // Step 4: Create an approval for the request
    const [approval] = await db.insert(approvals)
      .values({
        requestId: testRequest.id,
        approverId: testUser.id,
        status: 'approved',
        department: 'Finance',
        processedAt: new Date(),
        isMandatory: true
      })
      .returning();
    
    console.log('Created approval for the request');
    
    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Verify there are no duplicate notifications
    const notifications = await db.select()
      .from(notifications)
      .where(eq(notifications.requestId, testRequest.id))
      .orderBy(desc(notifications.createdAt));
    
    console.log(`Found ${notifications.length} notifications for the test request`);
    
    // Group notifications by type to check for duplicates
    const notificationsByType = notifications.reduce((acc, notification) => {
      const type = notification.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(notification);
      return acc;
    }, {});
    
    let duplicatesFound = false;
    
    for (const [type, typeNotifications] of Object.entries(notificationsByType)) {
      if (typeNotifications.length > 1) {
        duplicatesFound = true;
        console.error(`Found ${typeNotifications.length} duplicate notifications of type "${type}"`);
        typeNotifications.forEach(n => console.log(`  - ${n.id}: "${n.title}" (${new Date(n.createdAt).toISOString()})`));
      } else {
        console.log(`Type "${type}": 1 notification (OK)`);
      }
    }
    
    // Step 6: Check the final notification count
    const [{ count: finalCount }] = await db.select({
      count: sql`count(*)`.mapWith(Number)
    }).from(notifications);
    
    console.log(`Final notification count: ${finalCount}`);
    console.log(`Net change: ${finalCount - initialCount} notifications`);
    
    // Step 7: Clean up (optional - comment out to preserve test data)
    /*
    await db.delete(approvals).where(eq(approvals.requestId, testRequest.id));
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, testRequest.id));
    await db.delete(notifications).where(eq(notifications.requestId, testRequest.id));
    console.log('Test data cleaned up');
    */
    
    if (duplicatesFound) {
      console.error('❌ TEST FAILED: Duplicate notifications were found');
    } else {
      console.log('✅ TEST PASSED: No duplicate notifications were found');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testNotificationFixing()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed with error:', err));