import { ShieldCheck, EyeOff, CheckSquare } from "lucide-react";

export function ArchitectureSpec() {
  return (
    <section id="architecture" className="py-20 px-6 border-b border-slate-800/50">
      <div className="max-w-5xl mx-auto space-y-12">
        
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Cryptographic Mechanics</h2>
          <h3 className="text-2xl md:text-3xl font-bold text-slate-100">Realistic Privacy & Bidding Mechanics</h3>
          <p className="text-slate-400 text-sm max-w-2xl">
            Sealed decouples financial strategy from market visibility. Bidders prove solvency and lock commitments without leaking price ceilings to competitors.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-slate-200" />
            </div>
            <h4 className="text-base font-semibold text-slate-100">1. Client-Side Solvency Check</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Before entering an auction, a local ZK circuit verifies that your supported stablecoin balance satisfies the bid condition on-device, without broadcasting total net worth.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <EyeOff className="h-5 w-5 text-slate-200" />
            </div>
            <h4 className="text-base font-semibold text-slate-100">2. Hidden Commitment Escrow</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bids are hashed and locked into escrow during the active auction window. Market observers see that a commitment exists, but zero price or wallet identity data is leaked.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-slate-200" />
            </div>
            <h4 className="text-base font-semibold text-slate-100">3. Reveal-at-Close Settlement</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              At auction expiry, bid amounts are revealed to calculate the highest bidder deterministically. Losing bid commitments are unlocked immediately and refunded automatically.
            </p>
          </div>
        </div>

        <div id="settlement" className="p-6 rounded-lg bg-slate-950 border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <span>Engineering Note: Honest Privacy Guarantees</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The protocol uses <strong className="text-slate-200">Reveal-at-Close</strong> to guarantee verifiability without requiring a trusted intermediary. Full blind settlement via Threshold MPC is slated for future protocol iterations once distributed liveness proofs mature.
          </p>
        </div>
      </div>
    </section>
  );
}