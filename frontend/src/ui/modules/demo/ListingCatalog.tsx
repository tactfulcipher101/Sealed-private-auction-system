import { Building2, Gem, ArrowRight, Sparkles } from "lucide-react";
import type { Listing } from "@/lib/demoData";
import { formatCurrency } from "@/lib/demoCrypto";

interface ListingCatalogProps {
  listings: Listing[];
  onSelectListing: (listing: Listing) => void;
  highlightId?: string | null;
}

export function ListingCatalog({ listings, onSelectListing, highlightId }: ListingCatalogProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-slate-100">Live catalog</h1>
        <p className="text-sm text-slate-400">
          Listings are public. Bids never are. Pick one to see the bidding flow end to end.
        </p>
      </div>

      <div className="grid gap-4">
        {listings.map((listing) => {
          const Icon = listing.category === "real-estate" ? Building2 : Gem;
          const isNew = listing.id === highlightId;
          const thumbnail = listing.imageUrls && listing.imageUrls[0];
          return (
            <button
              key={listing.id}
              onClick={() => onSelectListing(listing)}
              className={
                "w-full text-left p-5 rounded-lg bg-slate-900/60 border transition-all flex items-center gap-4 " +
                (isNew ? "border-emerald-500/40" : "border-slate-800 hover:border-slate-700")
              }
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={listing.title}
                  className="h-11 w-11 shrink-0 rounded-lg object-cover border border-slate-700"
                />
              ) : (
                <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100 truncate">{listing.title}</p>
                  {isNew && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                      <Sparkles className="h-2.5 w-2.5" /> just listed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{listing.region}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">Reserve</p>
                <p className="text-sm font-mono text-slate-200">
                  {formatCurrency(listing.reservePrice, listing.currency)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
