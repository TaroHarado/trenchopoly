"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface BuyInButtonProps {
  gameId: string;
  buyInSol: number;
  onSuccess: () => void;
}

export function BuyInButton({ gameId, buyInSol, onSuccess }: BuyInButtonProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyIn = async () => {
    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare buy-in
      const prepareRes = await fetch("/api/wallet/prepare-game-buyin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
        credentials: "include",
      });

      if (!prepareRes.ok) {
        const errorData = await prepareRes.json();
        throw new Error(errorData.error || "Failed to prepare buy-in");
      }

      const { amountLamports, houseWalletPublicKey } = await prepareRes.json();

      // Create and send transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(houseWalletPublicKey),
          lamports: amountLamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);

      // Confirm buy-in
      const confirmRes = await fetch("/api/wallet/confirm-game-buyin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, signature }),
        credentials: "include",
      });

      if (!confirmRes.ok) {
        const errorData = await confirmRes.json();
        throw new Error(errorData.error || "Failed to confirm buy-in");
      }

      const result = await confirmRes.json();
      if (result.message) {
        // Idempotent - already paid
        setError(null);
      }
      onSuccess();
    } catch (err: any) {
      console.error("Buy-in error:", err);
      const errorMsg = err.message || "Failed to process buy-in. Please check your wallet balance and transaction status.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleBuyIn}
        disabled={loading || !publicKey}
        className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : `Pay ${buyInSol} SOL Buy-in`}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

