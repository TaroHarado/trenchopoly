"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function shortAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

export function WalletButton() {
  const { publicKey, connect, disconnect, signMessage, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const queryClient = useQueryClient();

  const { data: authData, isLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const handleLogin = async () => {
    if (!publicKey || !signMessage) return;

    try {
      // Get nonce
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
        credentials: "include",
      });

      if (!nonceRes.ok) {
        const errorData = await nonceRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get nonce");
      }

      const { nonce } = await nonceRes.json();

      // Sign message
      const message = `Login to Trenchopoly. Nonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      // Convert Uint8Array to base64 (browser-compatible)
      const signatureBase64 = btoa(
        String.fromCharCode(...signature)
      );

      // Verify
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          signature: signatureBase64,
          nonce,
        }),
        credentials: "include",
      });

      if (verifyRes.ok) {
        // Invalidate auth query to refetch
        queryClient.invalidateQueries({ queryKey: ["auth"] });
      } else {
        const error = await verifyRes.json();
        alert(error.error || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      alert(error.message || "Failed to authenticate");
    }
  };

  const handleConnect = async () => {
    try {
      // Open wallet selection modal
      setVisible(true);
    } catch (error: any) {
      console.error("Error opening wallet modal:", error);
      // Fallback: try direct connect if modal fails
      try {
        await connect();
      } catch (connectError: any) {
        console.error("Error connecting wallet:", connectError);
        alert("Failed to connect wallet. Please make sure Phantom is installed.");
      }
    }
  };

  if (isLoading || connecting) {
    return (
      <button className="btn-secondary px-6 py-2" disabled>
        Connecting...
      </button>
    );
  }

  if (!publicKey) {
    return (
      <button
        onClick={handleConnect}
        className="btn-primary"
      >
        Connect Wallet
      </button>
    );
  }

  if (!authData?.user) {
    return (
      <button
        onClick={handleLogin}
        className="btn-secondary"
      >
        {shortAddress(publicKey.toBase58())} - Sign & Login
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="btn-secondary"
    >
      {shortAddress(publicKey.toBase58())}
    </button>
  );
}
