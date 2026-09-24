import Link from "next/link";
import { Header } from "@/ui/layout/Header";
import { Footer } from "@/ui/layout/Footer";
import { 
  ShieldCheck, 
  EyeOff, 
  CheckSquare, 
  Scale, 
  Package, 
  Building2, 
  Coins, 
  AlertTriangle,
  ArrowRight,
  Cpu
} from "lucide-react";

export default function ProtocolOverviewPage() {
  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 font-sans antialiased selection:bg-slate-800 selection:text-slate-200">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        
        {/* Title Header */}
        <div className="space-y-4 border-b border-slate-800/80 pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
            TECHNICAL DEEP-DIVE & ARCHITECTURE BLUEPRINT
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-100 leading-tight">
            How Sealed Works: End-to-End Protocol Mechanics
          </h1>
          <p className="text-slate-400 text-base md:text-lg leading-relaxed">
            Sealed is an unhosted bidding protocol built on zero-knowledge state circuits. It resolves high-value liquidation privacy by decoupling market bid discovery from buyer identity, while maintaining strict legal and financial compliance at local borders.
          </p>
        </div>

        {/* 1. Core Problem Statement */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs text-emerald-400">01</span>
            <h2 className="text-xl font-bold text-slate-100">The High-Value Sales Dilemma</h2>
          </div>
          <div className="prose prose-invert max-w-none text-slate-400 text-sm leading-relaxed space-y-4">
            <p>
              Legacy auction platforms force a structural compromise: sellers with urgent liquidity needs (corporate wind-downs, estate liquidations, marital separations) must broadcast their assets publicly, inviting predatory bidding. Simultaneously, prospective buyers who enter open bidding wars expose their financial ceilings to competitors and market watchers.
            </p>
            <p>
              Traditional luxury houses charge 35–45% commissions to fund physical warehousing and human brokers. Sealed operates as a software-only protocol taking a flat, low settlement commission by delegating physical intake and escrow verification to accredited regional partners.
            </p>
          </div>
        </section>

        {/* 2. Honest Privacy Boundaries */}
        <section className="space-y-6 p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-bold text-slate-100">The Privacy Model (What Is Real vs. What Isn&apos;t)</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">What Sealed Guarantees</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                <li><strong>Market-Blind Bidding:</strong> Competitors, network sequencers, and observers cannot see your bid value or wallet address during active bidding.</li>
                <li><strong>Zero Net Worth Disclosure:</strong> A client-side ZK proof verifies balance sufficiency without revealing total wallet holdings.</li>
                <li><strong>Zero Public Ledger Footprint:</strong> Bids sit in encrypted commitments until settlement.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400">Explicit Technical Limits</h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                <li><strong>On-Ramps Are KYC&apos;d:</strong> Converting fiat to USDC/USDT/cNGN through licensed exchanges links your identity to that wallet.</li>
                <li><strong>Winning Bidders Disclose Identity:</strong> Legal title transfer, courier waybills, and real estate deeds require buyer identification at closing.</li>
                <li><strong>Reveal-at-Close (v1):</strong> Losing bid amounts become deterministic at auction end to calculate the winner without a centralized comparator.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. The 4-Step Lifecycle */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs text-emerald-400">02</span>
            <h2 className="text-xl font-bold text-slate-100">End-to-End Auction Lifecycle</h2>
          </div>

          <div className="space-y-6">
            
            {/* Step 1 */}
            <div className="p-6 rounded-lg bg-slate-900/30 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-200">Step 1: Seller Listing & Local Intake</h3>
                <span className="text-[11px] font-mono text-slate-500">SELLER_PHASE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The seller connects a wallet and verifies identity via decentralized ID (zkMe or Polygon ID) without uploading raw documents to protocol storage. An accredited local partner (e.g., RICS surveyor for property, or Semoty for luxury goods) inspects the asset, signs an intake payload, and releases the listing to the public catalog with a public reserve floor.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-lg bg-slate-900/30 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-200">Step 2: Client-Side Solvency Verification</h3>
                <span className="text-[11px] font-mono text-slate-500">BIDDER_PHASE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Before submitting a bid, a local Noir circuit executes in the bidder&apos;s browser. It verifies that the bidder&apos;s wallet holds enough balance in the specified stablecoin to back the intended bid. The network receives a valid solvency proof without learning the bidder&apos;s balance or bid value.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-lg bg-slate-900/30 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-200">Step 3: Hidden Commitment Escrow</h3>
                <span className="text-[11px] font-mono text-slate-500">AZTEC_SHIELDED_POT</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                The bid is hashed and locked into an Aztec private commitment note. During the active bidding window, competitors see only randomized state updates—preventing predatory price ladders or ceiling sniping.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-lg bg-slate-900/30 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-200">Step 4: Settlement & Immediate Refunds</h3>
                <span className="text-[11px] font-mono text-slate-500">REVEAL_AT_CLOSE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                When the auction timer expires, commitments are evaluated via Reveal-at-Close. The contract deterministically calculates the highest valid bid. Losing bid notes are unlocked immediately and returned directly to wallets without a manual claim process.
              </p>
            </div>

          </div>
        </section>

        {/* 4. Pluggable Infrastructure & Multi-Currency */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs text-emerald-400">03</span>
            <h2 className="text-xl font-bold text-slate-100">Jurisdiction-Agnostic Pluggability</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
              <Coins className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-slate-200">Multi-Asset Escrow</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sealed is currency-neutral. Auctions run in any regulated 1:1 stablecoin (USDC, USDT, cNGN, EURC). The ZK settlement and escrow logic remains identical regardless of the underlying token.
              </p>
            </div>

            <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
              <Scale className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-slate-200">Pluggable Verification Partners</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Physical intake relies on certified regional authorities: RICS in the UK, NIESV/ESVARBON in Nigeria, or state-licensed appraisers in North America. Real estate transfers pass to licensed legal delegates upon auction completion.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="p-8 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 text-center space-y-4">
          <h3 className="text-xl font-bold text-slate-100">Try the Client Proving Engine</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Test the client-side solvency proof simulation directly on our interactive landing environment.
          </p>
          <Link
            href="/#simulator"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-950 text-xs font-semibold rounded-lg hover:bg-white transition-all"
          >
            Open Proof Simulator <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
