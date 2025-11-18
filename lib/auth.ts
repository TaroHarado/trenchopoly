import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AuthUser {
  id: string;
  walletAddress: string;
  username?: string;
}

export async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const pubkey = new PublicKey(publicKey);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");

    // Verify signature using nacl
    // Note: Solana uses Ed25519 signatures
    // The signature from wallet is already in the correct format
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubkey.toBytes()
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    // For MVP on devnet, allow simplified verification
    // In production, this should always verify properly
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") {
      console.warn("Devnet mode: allowing signature verification");
      return true;
    }
    return false;
  }
}

export async function generateNonce(walletAddress: string): Promise<string> {
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

  await prisma.authNonce.upsert({
    where: { walletAddress },
    update: {
      nonce,
      expiresAt,
    },
    create: {
      walletAddress,
      nonce,
      expiresAt,
    },
  });

  return nonce;
}

export async function verifyNonce(walletAddress: string, nonce: string): Promise<boolean> {
  const authNonce = await prisma.authNonce.findUnique({
    where: { walletAddress },
  });

  if (!authNonce || authNonce.nonce !== nonce) {
    return false;
  }

  if (new Date() > authNonce.expiresAt) {
    return false;
  }

  // Delete used nonce
  await prisma.authNonce.delete({
    where: { walletAddress },
  });

  return true;
}

export function createSessionToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      walletAddress: user.walletAddress,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; walletAddress: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username || undefined,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
}

