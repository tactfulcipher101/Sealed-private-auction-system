import { ArrowLeft, ShieldCheck, EyeOff, Ban } from "lucide-react";
import type { Listing } from "@/lib/demoData";
import { formatCurrency } from "@/lib/demoCrypto";

interface ListingDetailProps {
  listing: Listing;
  isOwnListing?: boolean;
  onEnterBidding: () => void;
  onBack: () => void;
}

export function ListingDetail({ listing, isOwnListing, onEnterBidding, onBack }: ListingDetailProps) {
  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </button>

      {listing.imageUrls && listing.imageUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {listing.imageUrls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={listing.title + " photo " + (index + 1)}
              className="w-full h-24 object-cover rounded-lg border border-slate-800"
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-100">{listing.title}</h1>
        <p className="text-sm text-slate-400 leading-relaxed">{listing.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800">
          <p className="text-xs text-slate-500">Reserve price</p>
          <p className="text-base font-mono text-slate-100 mt-1">
            {formatCurrency(listing.reservePrice, listing.currency)}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800">
          <p className="text-xs text-slate-500">Verified by</p>
          <p className="text-sm text-slate-200 mt-1">{listing.verifiedBy}</p>
        </div>
      </div>

      {isOwnListing ? (
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3">
          <Ban className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            This listing belongs to your connected wallet, so bidding is disabled here. This
            mirrors the real protocol: a seller cannot bid on their own auction.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3">
          <EyeOff className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Once bidding opens, no other participant sees your wallet or your bid amount. You will
            not see theirs either. Everything unlocks together when the auction closes.
          </p>
        </div>
      )}

      <button
        onClick={onEnterBidding}
        className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white transition-all flex items-center justify-center gap-2"
      >
        <ShieldCheck className="h-4 w-4" />
        <span>{isOwnListing ? "Monitor auction" : "Enter private bidding"}</span>
      </button>
    </div>
  );
}

