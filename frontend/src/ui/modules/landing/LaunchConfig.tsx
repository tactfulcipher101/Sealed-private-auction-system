import { LATE_REVEAL_PENALTY_BPS, SETTLEMENT_FEE_BPS, calculateSellerProceeds } from "@/lib/auctionLogic";
import { defaultNetworkMode, getNetworkConfig } from "@/lib/network";

export function LaunchConfig() {
  const mode = defaultNetworkMode;
  const config = getNetworkConfig(mode);
  const displayValue = (value: string | null) => value ?? "Not configured";

  return (
    <section className="border-t border-slate-800 bg-slate-950/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">Launch config</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Testnet-first deployment, mainnet-ready parameters</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Network</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">{config.label}</p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                {mode}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Contract</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-200">{displayValue(config.contractAddress)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Treasury</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-200">{displayValue(config.treasuryAddress)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Listing verifier</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-200">{displayValue(config.assetVerifierAddress)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Pause threshold</p>
                <p className="mt-2 text-lg font-semibold text-white">{config.pauseThreshold} / 3</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Seller proceeds</p>
                <p className="mt-2 text-lg font-semibold text-white">{calculateSellerProceeds(100000).toLocaleString()} units</p>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm text-slate-300">
              <p>Node: {displayValue(config.nodeUrl)}</p>
              <p>Explorer: {displayValue(config.explorerUrl)}</p>
              <p className={config.isConfigured ? "text-emerald-300" : "text-amber-300"}>
                {config.isConfigured ? "Deployment settings present" : "Deployment settings incomplete"}
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contract defaults</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {mode === "testnet" ? "Testnet deployment profile" : "Mainnet deployment profile"}
              </p>
            </div>

            <dl className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                <dt>Settlement fee</dt>
                <dd>{SETTLEMENT_FEE_BPS / 100}%</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                <dt>Late reveal penalty</dt>
                <dd>{LATE_REVEAL_PENALTY_BPS / 100}%</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                <dt>Minimum reserve</dt>
                <dd>None enforced in contract</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
                <dt>Market route</dt>
                <dd>{config.label}</dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2">
                <dt>Configured tokens</dt>
                <dd className="text-right">{Object.keys(config.tokenAddresses).join(", ") || "None"}</dd>
              </div>
            </dl>

            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs leading-6 text-slate-400">
              Addresses and endpoints are environment supplied. The contract currently fixes fee and late-reveal penalty at compile time; changing those requires recompiling and redeploying Noir, not only switching frontend environment variables.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
