import { ArrowRight, ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-20 pb-16 px-6 border-b border-slate-800/50">
      <div className="max-w-5xl mx-auto text-center space-y-6">
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          Jurisdiction-Agnostic Zero-Knowledge Bidding
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-100 max-w-4xl mx-auto leading-tight">
          Market-Blind Auctions for High-Value Liquidation.
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
          Sealed hides your bid amount and identity from market competitors during active bidding while maintaining full regulatory compliance for on-ramps and physical closing.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a 
            href="#simulator"
            className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white transition-all flex items-center justify-center gap-2"
          >
            Test Solvency Circuit <ArrowRight className="h-4 w-4" />
          </a>
          <a 
            href="#architecture"
            className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-slate-300 border border-slate-800 text-sm font-medium rounded-lg hover:border-slate-700 hover:text-white transition-all"
          >
            Read Technical Blueprint
          </a>
        </div>

        <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-left max-w-4xl mx-auto">
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <p className="text-xs text-slate-400 font-medium">Bidding Privacy</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">Market-Blind</p>
            <p className="text-[11px] text-slate-400 mt-1">Competitors see zero bid values</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <p className="text-xs text-slate-400 font-medium">Settlement Phase</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">Reveal-at-Close</p>
            <p className="text-[11px] text-slate-400 mt-1">Verifiable deterministic winner</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <p className="text-xs text-slate-400 font-medium">Supported Assets</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">Multi-Stablecoin</p>
            <p className="text-[11px] text-slate-400 mt-1">USDC, USDT, cNGN & local rails</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <p className="text-xs text-slate-400 font-medium">Physical Delivery</p>
            <p className="text-xl font-semibold text-slate-100 mt-1">Pluggable Partners</p>
            <p className="text-[11px] text-slate-400 mt-1">Accredited local verification</p>
          </div>
        </div>

      </div>
    </section>
  );
}