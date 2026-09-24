"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Cpu, Lock } from "lucide-react";
import type { Listing, SimulatedBid } from "@/lib/demoData";
import { generateWalletAddress, generateCommitmentHash } from "@/lib/demoCrypto";

interface BidCommitFormProps {
  listing: Listing;
  onBidCommitted: (bid: SimulatedBid) => void;
  onCancel: () => void;
}

const PROOF_STAGES = [
  "Checking wallet balance on-device...",
  "Generating solvency proof...",
  "Encrypting bid commitment...",
  "Locking funds into escrow...",
];

export function BidCommitForm({ listing, onBidCommitted, onCancel }: BidCommitFormProps) {
  const [amount, setAmount] = useState("");
  const [isProving, setIsProving] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isProving) return;
    if (stageIndex >= PROOF_STAGES.length - 1) return;
    const timer = setTimeout(() => setStageIndex((i) => i + 1), 550);
    return () => clearTimeout(timer);
  }, [isProving, stageIndex]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    setIsProving(true);
    setStageIndex(0);

    setTimeout(() => {
      onBidCommitted({
        walletAddress: generateWalletAddress(),
        commitmentHash: generateCommitmentHash(),
        amount: parsedAmount,
        currency: listing.currency,
        isUser: true,
        submittedAt: Date.now(),
      });
    }, PROOF_STAGES.length * 550 + 300);
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onCancel}
        disabled={isProving}
        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to listing
      </button>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-100">Place a sealed bid</h2>
        <p className="text-sm text-slate-400">
          Reserve is {listing.reservePrice.toLocaleString()} {listing.currency}. Your amount is
          never shown to the seller or other bidders until close.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Your bid ({listing.currency})
          </label>
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={isProving}
            placeholder={"e.g. " + Math.round(listing.reservePrice * 1.1)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isProving || !amount}
          className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isProving ? (
            <>
              <Cpu className="h-4 w-4 animate-spin" /> {PROOF_STAGES[stageIndex]}
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Generate proof and commit bid
            </>
          )}
        </button>
      </form>
    </div>
  );
}
