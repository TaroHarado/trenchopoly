"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
export function WalletAuth() {
  const { publicKey, signMessage } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
    
    // Re-check when wallet changes
    if (publicKey) {
      checkAuth();
    }
  }, [publicKey]);

  const handleLogin = async () => {
    if (!publicKey || !signMessage) return;

    setLoading(true);
    try {
      // Get nonce
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to get nonce");
      }

      const { nonce } = await nonceRes.json();

      // Sign message
      const message = `Login to Trendopoly. Nonce: ${nonce}`;
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
      });

      if (verifyRes.ok) {
        setIsAuthenticated(true);
      } else {
        const error = await verifyRes.json();
        alert(error.error || "Authentication failed");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      alert(error.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">Connected</span>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <WalletMultiButton />
      {publicKey && (
        <button
          onClick={handleLogin}
          disabled={loading}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Signing..." : "Sign & Login"}
        </button>
      )}
    </div>
  );
}

