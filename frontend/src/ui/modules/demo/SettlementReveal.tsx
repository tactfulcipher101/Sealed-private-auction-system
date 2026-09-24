"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, RotateCcw, Undo2 } from "lucide-react";
import { formatCurrency } from "@/lib/demoCrypto";
import type { Listing, SimulatedBid } from "@/lib/demoData";

const REVEAL_INTERVAL_MS = 300;

interface SettlementRevealProps {
  listing: Listing;
  bids: SimulatedBid[];
  onRestart: () => void;
}

export function SettlementReveal({ listing, bids, onRestart }: SettlementRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
  const winner = sortedBids[0];
  const userBid = bids.find((bid) => bid.isUser);
  const userWon = winner?.isUser ?? false;

  useEffect(() => {
    if (revealedCount >= sortedBids.length) return;
    const timer = setTimeout(() => setRevealedCount((count) => count + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [revealedCount, sortedBids.length]);

  const allRevealed = revealedCount >= sortedBids.length;

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
        Auction closed. Commitments are being decrypted to determine the winner. This is the one
        moment amounts become visible, and only for this auction.
      </div>

      <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/80 overflow-y-auto max-h-96">
        {sortedBids.map((bid, index) => {
          const isRevealed = index < revealedCount;
          const isWinner = bid === winner && isRevealed;
          return (
            <div
              key={bid.commitmentHash}
              className={"flex items-center justify-between px-4 py-3 text-xs font-mono " + (isWinner ? "bg-emerald-500/10" : "bg-slate-950/40")}
            >
              <div className="flex items-center gap-2 text-slate-300">
                {bid.walletAddress}
                {bid.isUser && <span className="text-emerald-400">(you)</span>}
                {isWinner && <Trophy className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              {isRevealed ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={isWinner ? "text-emerald-400" : "text-slate-500"}
                >
                  {formatCurrency(bid.amount, bid.currency)}
                  {!isWinner && (
                    <span className="ml-2 inline-flex items-center gap-1 text-slate-600">
                      <Undo2 className="h-3 w-3" /> refunded
                    </span>
                  )}
                </motion.span>
              ) : (
                <span className="text-slate-600 tracking-widest">revealing...</span>
              )}
            </div>
          );
        })}
      </div>

      {allRevealed && userBid && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={"p-6 rounded-lg border text-center space-y-2 " + (userWon ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/60 border-slate-800")}
        >
          <p className="text-base font-semibold text-slate-100">
            {userWon ? "You won this auction." : "You were outbid."}
          </p>
          <p className="text-xs text-slate-400">
            {userWon
              ? "Your identity is now shared with the seller and verification partner to arrange " +
                (listing.category === "real-estate" ? "legal closing." : "double-blind delivery.")
              : "Your " +
                formatCurrency(userBid.amount, userBid.currency) +
                " commitment was released back to your wallet automatically. No claim needed."}
          </p>
        </motion.div>
      )}

      {allRevealed && (
        <button
          onClick={onRestart}
          className="w-full py-3 bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium rounded-lg hover:border-slate-700 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="h-4 w-4" /> Try another listing
        </button>
      )}
    </div>
  );
}

