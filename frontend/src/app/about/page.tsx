import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          About Sealed
        </p>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Auctions where your bid stays private.
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-neutral-400">
          Sealed is a private bidding protocol for high-value assets. The goal
          is simple: participants should be able to compete without exposing
          their bid or identity to the market during the auction.
        </p>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="font-medium">Private bidding</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Your bid is committed before the auction closes, so other
              participants cannot see the amount you submitted during bidding.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="font-medium">Deterministic settlement</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              At the end of the auction, committed bids are revealed and the
              winning result can be independently verified.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
            <h2 className="font-medium">Physical settlement</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Physical assets can be handled through appropriate local
              verification, legal and logistics partners.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/demo"
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            Try the live demo
          </Link>

          <Link
            href="/protocol"
            className="rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-900"
          >
            Read the protocol
          </Link>
        </div>
      </section>
    </main>
  );
}
