'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { CaseItem } from '@/lib/types/case';

interface CaseOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  priceSol?: number;
  free?: boolean;
  onSuccess?: () => void;
}

export function CaseOpenModal({
  isOpen,
  onClose,
  caseId,
  priceSol = 0,
  free = false,
  onSuccess,
}: CaseOpenModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [rolling, setRolling] = useState(false);
  const [resultItem, setResultItem] = useState<CaseItem | null>(null);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  async function handleOpen() {
    if (rolling || processingPayment) return;
    
    // Check wallet connection for paid cases
    if (!free && priceSol > 0) {
      if (!publicKey || !sendTransaction) {
        setError('Please connect your wallet to open paid cases');
        return;
      }
    }

    setRolling(true);
    setResultItem(null);
    setError(null);

    try {
      let item: CaseItem;

      // For paid cases, process payment first
      if (!free && priceSol > 0) {
        setProcessingPayment(true);

        // Step 1: Prepare payment
        const prepareRes = await fetch('/api/wallet/prepare-case-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ caseId }),
        });

        if (!prepareRes.ok) {
          const errorData = await prepareRes.json();
          setRolling(false);
          setProcessingPayment(false);
          setError(errorData.error || 'Failed to prepare payment');
          return;
        }

        const { amountLamports, houseWalletPublicKey } = await prepareRes.json();

        // Step 2: Create and send transaction
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: new PublicKey(houseWalletPublicKey),
            lamports: amountLamports,
          })
        );

        const signature = await sendTransaction(transaction, connection);

        // Step 3: Confirm payment and get item
        const confirmRes = await fetch('/api/wallet/confirm-case-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ caseId, signature }),
        });

        if (!confirmRes.ok) {
          const errorData = await confirmRes.json();
          setRolling(false);
          setProcessingPayment(false);
          setError(errorData.error || 'Failed to confirm payment');
          return;
        }

        const confirmData = await confirmRes.json();
        if (!confirmData.success || !confirmData.item) {
          setRolling(false);
          setProcessingPayment(false);
          setError('Failed to open case after payment');
          return;
        }

        item = confirmData.item;
        setProcessingPayment(false);
      } else {
        // For free cases, just open directly
        const res = await fetch('/api/cases/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ caseId }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setRolling(false);
          setError(data.error || 'Failed to open case');
          return;
        }

        item = data.item;
      }

      setResultItem(item);

      // Build reel with filler items
      const filler: CaseItem[] = new Array(50).fill(null).map((_, i) => ({
        id: `filler-${i}`,
        name: '???',
        ticker: '???',
        rarity: 'COMMON',
        imageUrl: '/cards/common-placeholder.png',
      }));

      const reel = [...filler];
      // Place real item near the end
      reel[reel.length - 3] = item;
      setReelItems(reel);
    } catch (err: any) {
      setRolling(false);
      setProcessingPayment(false);
      setError(err.message || 'Failed to open case');
    }
  }

  const reelWidth = useMemo(() => reelItems.length * 140, [reelItems.length]);
  const targetPosition = useMemo(() => -reelWidth + 420, [reelWidth]);

  if (!isOpen) return null;

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'ULTRA': return 'text-yellow-400 border-yellow-400';
      case 'EPIC': return 'text-purple-400 border-purple-400';
      case 'RARE': return 'text-blue-400 border-blue-400';
      default: return 'text-gray-400 border-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-3xl bg-[#050509] rounded-2xl border border-white/10 p-6 md:p-8 flex flex-col gap-6 shadow-xl shadow-black/50 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors text-2xl font-light z-10 w-8 h-8 flex items-center justify-center"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-semibold text-orange-400 text-center">
          Opening case…
        </h2>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 font-medium">
            {error}
          </div>
        )}

        {/* Reel / Carousel */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-black/60 h-40 md:h-48 flex items-center">
          {reelItems.length > 0 && (
            <motion.div
              initial={{ x: 0 }}
              animate={rolling ? { x: targetPosition } : {}}
              transition={{ duration: 4, ease: 'easeOut' }}
              className="flex gap-3 py-6 px-4"
              onAnimationComplete={() => {
                setRolling(false);
                if (resultItem && onSuccess) {
                  onSuccess();
                }
              }}
            >
              {reelItems.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="w-24 md:w-28 h-32 md:h-36 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shadow-lg flex-shrink-0"
                >
                  {item.imageUrl && item.name !== '???' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                      <div className="text-3xl md:text-4xl mb-1">🎴</div>
                      <div className="font-semibold text-white text-[10px] md:text-xs">{item.name}</div>
                      <div className={`text-[8px] md:text-[10px] font-semibold ${getRarityColor(item.rarity)}`}>
                        {item.rarity}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-4xl md:text-5xl opacity-50 text-white/40">❓</div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Result display */}
        {!rolling && resultItem && (
          <div className="p-6 bg-black/40 border border-white/10 rounded-xl">
            <div className="text-center mb-4">
              <div className="text-sm text-white/60 font-medium mb-2">You received</div>
              <div className={`text-2xl md:text-3xl font-semibold mb-2 ${getRarityColor(resultItem.rarity)}`}>
                {resultItem.name}
              </div>
              <div className={`text-base md:text-lg font-semibold ${getRarityColor(resultItem.rarity)}`}>
                {resultItem.rarity}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setResultItem(null);
                  setReelItems([]);
                  handleOpen();
                }}
                className="px-6 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-medium transition-colors"
              >
                Open again
              </button>
            </div>
          </div>
        )}

        {/* Initial open button */}
        {!rolling && !resultItem && !error && (
          <div className="flex justify-center">
            <button
              onClick={handleOpen}
              disabled={processingPayment || (!free && priceSol > 0 && !publicKey)}
              className="px-8 py-4 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 rounded-lg text-orange-400 font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingPayment 
                ? 'Processing payment...' 
                : !free && priceSol > 0 && !publicKey
                  ? 'Connect wallet to open'
                  : 'Open case'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
