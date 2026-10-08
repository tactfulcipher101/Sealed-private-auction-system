import { ArrowLeft, ShieldCheck, EyeOff, Ban } from "lucide-react";
import type { Listing } from "@/lib/demoData";
import { formatCurrency } from "@/lib/demoCrypto";
import { useEffect, useState } from "react";
import { Fr } from "@aztec/foundation/curves/bn254";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { readListingOnChain } from "@/lib/sealedAuction";

interface ListingDetailProps {
  listing: Listing;
  isOwnListing?: boolean;
  connection?: ConnectedAztecWallet | null;
  onEnterBidding: () => void;
  onBack: () => void;
}

export function ListingDetail({ listing, isOwnListing, connection, onEnterBidding, onBack }: ListingDetailProps) {
  const [chainStatus, setChainStatus] = useState<{ id: string; line: string } | null>(null);

  useEffect(() => {
    if (!listing.onChain || !connection) return;
    const activeConnection = connection;
    const targetListingId = listing.id;
    let cancelled = false;
    const loadChainStatus = async () => {
      try {
        const state = await readListingOnChain(activeConnection, Fr.fromString(targetListingId));
        if (!cancelled) {
          setChainStatus({ id: targetListingId, line: `Chain status: ${state.statusLabel}, close timestamp ${state.closeTimestamp}` });
        }
      } catch (error) {
        if (!cancelled) {
          setChainStatus({ id: targetListingId, line: `Chain status unavailable: ${error instanceof Error ? error.message : "read failed"}` });
        }
      }
    };
    void loadChainStatus();
    return () => {
      cancelled = true;
    };
  }, [connection, listing.id, listing.onChain]);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {listing.onChain ? (
        <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs leading-relaxed text-emerald-100/80">
            This listing was created on-chain. Bid submission and auction monitoring for deployed listings are not connected in this frontend yet.
          </p>
          <p className="text-[11px] leading-5 text-slate-400">
            The descriptive metadata shown here is local to this browser session; it is not stored in the auction contract.
          </p>
          {chainStatus?.id === listing.id && (
            <p className="font-mono text-[11px] text-emerald-200/80">{chainStatus.line}</p>
          )}
          {listing.transactionHash && (
            <p className="break-all font-mono text-[10px] text-emerald-200/70">Transaction {listing.transactionHash}</p>
          )}
        </div>
      ) : isOwnListing ? (
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3">
          <Ban className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            This listing belongs to your connected wallet, so bidding is disabled in this demo.
            The contract rejects bids from the listing's seller address; a second account is not blocked.
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
        disabled={listing.onChain}
        className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <ShieldCheck className="h-4 w-4" />
        <span>{listing.onChain ? "Bidding not connected" : isOwnListing ? "Monitor auction" : "Enter private bidding"}</span>
      </button>
    </div>
  );
}

