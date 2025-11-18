import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { solToLamports } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { TRENCHOPOLY_CASES } from "@/config/cases";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { caseId } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: "caseId is required" },
        { status: 400 }
      );
    }

    // Find case in config
    const lootCase = TRENCHOPOLY_CASES.find(c => c.id === caseId);

    if (!lootCase) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Check if case is free
    if (lootCase.free || lootCase.priceSol === 0) {
      return NextResponse.json(
        { error: "This case is free, no payment required" },
        { status: 400 }
      );
    }

    const houseWallet = process.env.HOUSE_WALLET_PUBLIC_KEY;
    if (!houseWallet) {
      return NextResponse.json(
        { error: "House wallet not configured" },
        { status: 500 }
      );
    }

    try {
      new PublicKey(houseWallet);
    } catch {
      return NextResponse.json(
        { error: "Invalid house wallet address" },
        { status: 500 }
      );
    }

    const amountLamports = solToLamports(lootCase.priceSol);

    return NextResponse.json({
      amountLamports,
      houseWalletPublicKey: houseWallet,
      caseId: lootCase.id,
      priceSol: lootCase.priceSol,
    });
  } catch (error) {
    console.error("Error preparing case payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

