import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth";
import { isValidSolanaAddress } from "@/lib/solana";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana address" },
        { status: 400 }
      );
    }

    const nonce = await generateNonce(walletAddress);

    return NextResponse.json({ nonce });
  } catch (error: any) {
    console.error("Error generating nonce:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate nonce. Please try again." },
      { status: 500 }
    );
  }
}

