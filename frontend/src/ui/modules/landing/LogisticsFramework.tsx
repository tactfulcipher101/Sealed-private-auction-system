import { Building2, Package, CheckCircle2, Globe2 } from "lucide-react";

export function LogisticsFramework() {
  return (
    <section id="physical-verification" className="py-20 px-6 border-b border-slate-800/50 bg-slate-950/50">
      <div className="max-w-5xl mx-auto space-y-12">
        
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Jurisdiction-Agnostic Execution</h2>
          <h3 className="text-2xl md:text-3xl font-bold text-slate-100">Pluggable Logistics & Local Partners</h3>
          <p className="text-slate-400 text-sm max-w-2xl">
            Sealed delegates offline verification and physical delivery to accredited regional partners, keeping software infrastructure lean and legally scalable.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-8 rounded-lg bg-slate-900/40 border border-slate-800 space-y-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-slate-200" />
              <h4 className="text-lg font-semibold text-slate-100">Mobile High-Value Goods</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Handled through double-blind courier protocols (encrypted waybills with separated pickup/drop-off tokens). Integrated with regional and global couriers (DHL, local logistics partners).
            </p>
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Configurable Verification Holding Window (e.g. 24h)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Global Authentication Partners (Real Authentication, etc.)</span>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-lg bg-slate-900/40 border border-slate-800 space-y-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-200" />
              <h4 className="text-lg font-semibold text-slate-100">Immobile Real Estate & Land</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bidding and discovery stay private until close. Legal transfer is executed by accredited local professionals (RICS in UK, NIESV/ESVARBON in NG, state-licensed appraisers in US).
            </p>
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Configurable Commitment Stake (e.g. 10%)</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Automated Stake Slasher for Failure to Close</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg bg-slate-900/30 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-slate-300">
              <strong>Multi-Country Onboarding:</strong> Launching in new regions requires configuring local stablecoin liquidity, local accredited surveyor rails, and legal compliance review.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}