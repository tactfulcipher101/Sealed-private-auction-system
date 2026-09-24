"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Users } from "lucide-react";
import { generateWalletAddress, generateCommitmentHash, randomBidAmount } from "@/lib/demoCrypto";
import type { Listing, SimulatedBid } from "@/lib/demoData";

const AUCTION_DURATION_SECONDS = 24;
const MIN_SIMULATED_COMPETITORS = 6;
const MAX_SIMULATED_COMPETITORS = 19;

interface LiveAuctionRoomProps {
  listing: Listing;
  userBid?: SimulatedBid | null;
  onAuctionClosed: (allBids: SimulatedBid[]) => void;
}

export function LiveAuctionRoom({ listing, userBid, onAuctionClosed }: LiveAuctionRoomProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(AUCTION_DURATION_SECONDS);
  const [bids, setBids] = useState<SimulatedBid[]>(userBid ? [userBid] : []);

  useEffect(() => {
    const span = MAX_SIMULATED_COMPETITORS - MIN_SIMULATED_COMPETITORS + 1;
    const competitorCount = MIN_SIMULATED_COMPETITORS + Math.floor(Math.random() * span);
    const spawnTimers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < competitorCount; i++) {
      const windowMs = AUCTION_DURATION_SECONDS * 1000 - 2500;
      const delayMs = 800 + Math.random() * windowMs;
      spawnTimers.push(
        setTimeout(() => {
          setBids((current) => [
            ...current,
            {
              walletAddress: generateWalletAddress(),
              commitmentHash: generateCommitmentHash(),
              amount: randomBidAmount(listing.reservePrice),
              currency: listing.currency,
              isUser: false,
              submittedAt: Date.now(),
            },
          ]);
        }, delayMs)
      );
    }

    return () => spawnTimers.forEach(clearTimeout);
  }, [listing.reservePrice, listing.currency]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onAuctionClosed(bids);
      return;
    }
    const tick = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsRemaining]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Users className="h-4 w-4 text-emerald-400" />
          {bids.length} commitment{bids.length === 1 ? "" : "s"} locked in escrow
        </div>
        <div className="font-mono text-sm text-slate-100">
          Closes in {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/80 overflow-y-auto max-h-80">
        <AnimatePresence initial={false}>
          {bids.map((bid) => (
            <motion.div
              key={bid.commitmentHash}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={"flex items-center justify-between px-4 py-3 text-xs font-mono " + (bid.isUser ? "bg-emerald-500/5" : "bg-slate-950/40")}
            >
              <div className="flex items-center gap-2 text-slate-300">
                <Lock className="h-3.5 w-3.5 text-slate-600" />
                {bid.walletAddress}
                {bid.isUser && <span className="text-emerald-400">(you)</span>}
              </div>
              <div className="text-slate-600 tracking-widest">HIDDEN UNTIL CLOSE</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <p className="text-[11px] text-slate-500">
        Every commitment above is simulated for this demo and hidden from other participants,
        including the seller. Amounts unlock only when the auction closes.
      </p>
    </div>
  );
}

