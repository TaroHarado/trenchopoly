import { NextRequest, NextResponse } from "next/server";
import { verifyNonce, verifySignature, createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSolanaAddress } from "@/lib/solana";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, signature, nonce } = body;

    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json(
        { error: "Wallet address, signature, and nonce are required" },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana address" },
        { status: 400 }
      );
    }

    // Verify nonce
    const nonceValid = await verifyNonce(walletAddress, nonce);
    if (!nonceValid) {
      return NextResponse.json(
        { error: "Invalid or expired nonce" },
        { status: 401 }
      );
    }

    // Verify signature
    const message = `Login to Trenchopoly. Nonce: ${nonce}`;
    const signatureValid = await verifySignature(message, signature, walletAddress);
    if (!signatureValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Check if database is available
    const hasDatabase = process.env.DATABASE_URL && 
      process.env.DATABASE_URL !== "file:./prisma/dev.db" &&
      !process.env.DATABASE_URL.includes("undefined");

    let user;
    
    if (hasDatabase) {
      try {
        // Get or create user in database
        user = await prisma.user.findUnique({
          where: { walletAddress },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              walletAddress,
            },
          });
        }
      } catch (dbError: any) {
        console.warn("[AUTH_VERIFY] Database error, using walletAddress as ID:", dbError?.message);
        // Fallback: use walletAddress as ID
        user = {
          id: walletAddress,
          walletAddress,
          username: null,
        };
      }
    } else {
      // No database: use walletAddress as ID
      user = {
        id: walletAddress,
        walletAddress,
        username: null,
      };
    }

    // Create session token
    const token = createSessionToken({
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username || undefined,
    });

    // Set cookie
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Error verifying auth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

