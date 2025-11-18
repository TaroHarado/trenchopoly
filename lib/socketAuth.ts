import { Socket } from "socket.io";
import { getSessionUser } from "./auth";
import { IncomingMessage } from "http";

// Helper to extract cookies from socket handshake
function getCookiesFromSocket(socket: Socket): string | undefined {
  const req = socket.request as IncomingMessage;
  return req.headers.cookie;
}

// Verify user session from socket connection
export async function verifySocketAuth(socket: Socket): Promise<{ userId: string; walletAddress: string } | null> {
  try {
    // Get cookies from handshake
    const cookies = getCookiesFromSocket(socket);
    if (!cookies) {
      return null;
    }

    // Extract session token from cookies
    const sessionTokenMatch = cookies.match(/session_token=([^;]+)/);
    if (!sessionTokenMatch) {
      return null;
    }

    const token = sessionTokenMatch[1];
    
    // Verify token (simplified - in production use proper JWT verification)
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; walletAddress: string };
      
      // Get user from DB to ensure it still exists
      const { prisma } = await import("./prisma");
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        walletAddress: user.walletAddress,
      };
    } catch {
      return null;
    }
  } catch (error) {
    console.error("Socket auth error:", error);
    return null;
  }
}

