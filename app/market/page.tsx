"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WalletButton } from "@/components/WalletButton";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { CaseOpenModal } from "@/components/cases/CaseOpenModal";


export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<"cases" | "marketplace" | "inventory">("cases");

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-medium text-black">
            Marketplace
          </h1>
          <WalletButton />
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-1 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("cases")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "cases"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Cases
            </button>
            <button
              onClick={() => setActiveTab("marketplace")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "marketplace"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "inventory"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              My Inventory
            </button>
          </div>

          {/* Content */}
          {activeTab === "cases" && <CasesTab />}
          {activeTab === "marketplace" && <MarketplaceTab />}
          {activeTab === "inventory" && <InventoryTab />}
        </div>
      </div>
    </div>
  );
}

function CasesTab() {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cases-list"],
    queryFn: async () => {
      const res = await fetch("/api/cases/list", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch cases");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg font-medium">Loading cases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg font-medium mb-4">Error loading cases</p>
        <button
          onClick={() => refetch()}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data?.cases || data.cases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No cases available</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.cases.map((lootCase: {
          id: string;
          title: string;
          priceSol: number;
          free: boolean;
          opened: boolean;
        }) => (
          <div key={lootCase.id} className="card p-8">
            <h3 className="text-2xl font-semibold mb-4 text-black">{lootCase.title}</h3>
            
            {lootCase.free ? (
              <div className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-full mb-4 font-medium">
                FREE
              </div>
            ) : (
              <p className="text-2xl font-semibold mb-4 text-black">
                {lootCase.priceSol} SOL
              </p>
            )}

            <div className="mb-6">
              <p className="text-sm text-gray-600 font-medium mb-3">Drop chances:</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded font-medium">80% COMMON</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded font-medium">12% RARE</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded font-medium">5% EPIC</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded font-medium">3% ULTRA</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedCaseId(lootCase.id)}
              disabled={lootCase.free && lootCase.opened}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lootCase.free && lootCase.opened 
                ? "Already opened" 
                : lootCase.free 
                  ? "Open free case" 
                  : `Open for ${lootCase.priceSol} SOL`}
            </button>
          </div>
        ))}
      </div>

      {selectedCaseId && (() => {
        const selectedCase = data?.cases?.find((c: { id: string }) => c.id === selectedCaseId);
        return (
          <CaseOpenModal
            isOpen={!!selectedCaseId}
            onClose={() => {
              setSelectedCaseId(null);
              refetch();
            }}
            caseId={selectedCaseId}
            priceSol={selectedCase?.priceSol}
            free={selectedCase?.free}
            onSuccess={() => {
              refetch();
            }}
          />
        );
      })()}
    </>
  );
}

function MarketplaceTab() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { data, refetch } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/listings", { credentials: "include" });
      return res.json();
    },
  });

  const [buying, setBuying] = useState<string | null>(null);

  const handleBuy = async (listingId: string, priceSol: number) => {
    if (!publicKey || !sendTransaction) {
      alert("Please connect your wallet");
      return;
    }

    setBuying(listingId);
    try {
      // Prepare buy
      const prepareRes = await fetch("/api/wallet/prepare-market-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
        credentials: "include",
      });

      if (!prepareRes.ok) {
        const error = await prepareRes.json();
        throw new Error(error.error || "Failed to prepare purchase");
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

      // Confirm buy
      const confirmRes = await fetch("/api/wallet/confirm-market-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, signature }),
        credentials: "include",
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || "Failed to confirm purchase");
      }

      alert("Purchase successful!");
      refetch();
    } catch (error: any) {
      console.error("Buy error:", error);
      alert(error.message || "Failed to purchase item");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {data?.listings?.map((listing: {
        id: string;
        priceSol: number;
        inventoryItem: {
          customItem: {
            name: string;
            rarity: string;
          };
        };
      }) => (
        <div key={listing.id} className="card p-6">
          <h3 className="text-xl font-semibold mb-2 text-black">
            {listing.inventoryItem.customItem.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3 font-medium">
            Rarity: {listing.inventoryItem.customItem.rarity}
          </p>
          <p className="text-2xl font-semibold mb-6 text-black">
            {listing.priceSol} SOL
          </p>
          <button
            onClick={() => handleBuy(listing.id, listing.priceSol)}
            disabled={buying === listing.id || !publicKey}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buying === listing.id ? "Processing..." : "Buy Now"}
          </button>
        </div>
      ))}
      {(!data?.listings || data.listings.length === 0) && (
        <div className="col-span-3 text-center py-12 text-gray-500">
          <p className="text-lg">No listings available</p>
        </div>
      )}
    </div>
  );
}

function InventoryTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch inventory");
      }
      return res.json();
    },
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'ULTRA': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'EPIC': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'RARE': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg font-medium">Loading inventory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg font-medium">Error loading inventory</p>
        <p className="text-gray-500 text-sm mt-2">Please make sure you&apos;re logged in</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {data?.inventory?.map((item: {
        id: string;
        type: 'CASE_ITEM' | 'CUSTOM_ITEM';
        itemId?: string;
        rarity?: string;
        caseId?: string;
        name?: string;
        ticker?: string;
        imageUrl?: string;
        customItem?: {
          name: string;
          rarity: string;
          type: string;
        };
        createdAt: string;
      }) => {
        // Handle case items - use enriched data from API
        if (item.type === 'CASE_ITEM' && item.itemId) {
          const itemName = item.name || item.itemId;
          const itemRarity = item.rarity || 'COMMON';

          return (
            <div key={item.id} className="card p-6">
              <h3 className="font-semibold mb-2 text-black text-lg">{itemName}</h3>
              <p className={`text-sm mb-4 font-medium text-center px-3 py-1 rounded-full border ${getRarityColor(itemRarity)}`}>
                {itemRarity}
              </p>
              <button className="btn-secondary w-full text-sm py-2">
                List for Sale
              </button>
            </div>
          );
        }

        // Handle custom items
        if (item.type === 'CUSTOM_ITEM' && item.customItem) {
          return (
            <div key={item.id} className="card p-6">
              <h3 className="font-semibold mb-2 text-black text-lg">{item.customItem.name}</h3>
              <p className="text-sm text-gray-600 mb-4 font-medium text-center">
                {item.customItem.rarity}
              </p>
              <button className="btn-secondary w-full text-sm py-2">
                List for Sale
              </button>
            </div>
          );
        }

        return null;
      })}
      {(!data?.inventory || data.inventory.length === 0) && (
        <div className="col-span-4 text-center py-12 text-gray-500">
          <p className="text-lg">Your inventory is empty</p>
        </div>
      )}
    </div>
  );
}
