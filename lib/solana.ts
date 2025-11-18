import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
    const defaultEndpoint = network === "mainnet-beta" 
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
    const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || defaultEndpoint;
    connection = new Connection(rpcEndpoint, "confirmed");
  }
  return connection;
}

export function getNetwork(): "devnet" | "mainnet-beta" {
  return (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as "devnet" | "mainnet-beta";
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function buildTransferTx(
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountLamports: number
): Transaction {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: amountLamports,
    })
  );
  return transaction;
}

export async function verifyTransferSignature(
  signature: string,
  expectedTo: string,
  minAmountLamports: number,
  expectedFrom?: string // Optional: verify sender matches authenticated user
): Promise<{ valid: boolean; error?: string }> {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    if (!tx.meta) {
      return { valid: false, error: "Transaction metadata missing" };
    }

    if (tx.meta.err) {
      return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
    }

    // Verify sender if provided
    if (expectedFrom) {
      // Handle both legacy and versioned transactions
      const accountKeys = tx.transaction.message.getAccountKeys();
      const staticAccountKeys = accountKeys.staticAccountKeys;
      
      // The first signer is typically the fee payer (sender)
      const senderPubkey = staticAccountKeys[0];
      if (senderPubkey.toBase58() !== expectedFrom) {
        return { 
          valid: false, 
          error: `Transaction sender mismatch: expected ${expectedFrom}, got ${senderPubkey.toBase58()}` 
        };
      }
    }

    const expectedToPubkey = new PublicKey(expectedTo);
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;

    // Find the account index for expectedTo
    // Handle both legacy and versioned transactions
    const accountKeys = tx.transaction.message.getAccountKeys();
    const staticAccountKeys = accountKeys.staticAccountKeys;
    const toIndex = staticAccountKeys.findIndex(
      (key: PublicKey) => key.toBase58() === expectedTo
    );

    if (toIndex === -1) {
      return { valid: false, error: "Recipient not found in transaction" };
    }

    const balanceChange = postBalances[toIndex] - preBalances[toIndex];
    if (balanceChange < minAmountLamports) {
      return { 
        valid: false, 
        error: `Insufficient transfer: expected ${minAmountLamports}, got ${balanceChange}` 
      };
    }

    return { valid: true };
  } catch (error: any) {
    console.error("Error verifying transfer:", error);
    return { valid: false, error: error.message || "Verification failed" };
  }
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

