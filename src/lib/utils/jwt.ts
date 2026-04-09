/**
 * LIGHTWEIGHT JWT DECODER (HARDENED)
 * 
 * Optimized for both Edge and Node.js runtimes. 
 * Handles base64url padding and UTF-8 multi-byte characters correctly.
 */

export interface DecodedUser {
  id: number;
  username: string;
  department: string;
  role: string;
  email: string;
  isActive: boolean;
  isApprover: boolean;
  exp: number;
}

export function decodeJwtPayload(token: string): DecodedUser | null {
  try {
    if (!token || typeof token !== 'string') return null;
    
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // The second part is the payload
    const base64Url = parts[1];
    if (!base64Url) return null;

    // Handle Base64Url to Base64 conversion
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    
    // Add padding if missing (crucial for atob and some decoders)
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    let decodedStr: string;

    // Native Node.js check (High performance for Server)
    if (typeof Buffer !== 'undefined') {
      decodedStr = Buffer.from(base64, 'base64').toString('utf8');
    } 
    // Browser / Edge check (using atob + UTF8 decoder)
    else if (typeof atob !== 'undefined') {
      const binaryStr = atob(base64);
      decodedStr = decodeURIComponent(
        binaryStr
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else {
      throw new Error("No available decoder found in environment");
    }

    const payload = JSON.parse(decodedStr);
    
    // STRICT SANITY CHECK: Ensure all critical fields exist
    // If we return a partial object, AuthContext might think we have a user but fail permissions checks later.
    if (!payload.id || !payload.username || !payload.role || !payload.department) {
      console.warn("[JWT-Light] Missing critical fields in token payload:", {
        hasId: !!payload.id,
        hasUser: !!payload.username,
        hasRole: !!payload.role,
        hasDept: !!payload.department
      });
      return null;
    }

    return payload as DecodedUser;
  } catch (error) {
    console.error("[JWT-Light] Decoding failure (Malformed JSON or Base64):", error);
    return null;
  }
}

/**
 * Checks if a token is temporally expired (non-cryptographic check)
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return (payload.exp || 0) < currentTime;
  } catch {
    return true;
  }
}
