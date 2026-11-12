import { ArrowLeft, ShieldCheck, EyeOff, Ban } from "lucide-react";
import type { Listing } from "@/lib/demoData";
import { formatCurrency } from "@/lib/demoCrypto";
import { useEffect, useState } from "react";
import { Fr } from "@aztec-labs/foundation/curves/bn254";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { readListingOnChain } from "@/lib/sealedAuction";
import { OnChainBidPanel } from "./OnChainBidPanel";
import { buildShareLink } from "@/lib/shareLink";

interface ListingDetailProps {
  listing: Listing;
  isOwnListing?: boolean;
  connection?: ConnectedAztecWallet | null;
  onEnterBidding: () => void;
  onBack: () => void;
}

type ChainStatus = { id: string; line: string; status: bigint | null };

export function ListingDetail({ listing, isOwnListing, connection, onEnterBidding, onBack }: ListingDetailProps) {
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!listing.onChain || !connection) return;
    const activeConnection = connection;
    const targetListingId = listing.id;
    let cancelled = false;
    let inFlight = false;
    const loadChainStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await readListingOnChain(activeConnection, Fr.fromString(targetListingId));
        if (!cancelled) {
          setChainStatus({
            id: targetListingId,
            line: `Chain status: ${state.statusLabel}, close timestamp ${state.closeTimestamp}`,
            status: state.status,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setChainStatus({
            id: targetListingId,
            line: `Chain status unavailable: ${error instanceof Error ? error.message : "read failed"}`,
            status: null,
          });
        }
      } finally {
        inFlight = false;
      }
    };
    void loadChainStatus();
    const refreshTimer = setInterval(() => void loadChainStatus(), 20000);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [connection, listing.id, listing.onChain]);

  async function handleCopyLink() {
    const link = buildShareLink(listing);
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", link);
    }
  }

  const currentStatus = chainStatus?.id === listing.id ? chainStatus.status : null;

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
          <p className="text-xs text-slate-500">Verification status</p>
          <p className="text-sm text-slate-200 mt-1">{listing.verifiedBy}</p>
        </div>
      </div>

      {listing.onChain ? (
        <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs leading-relaxed text-amber-100/90">
            This permissionless listing is not independently verified. Bids can be committed while it is open and manually revealed from the bidder&apos;s wallet after close. Claims are CLI-only because they require the auction key in the claimant&apos;s PXE; never enter that secret here.
          </p>
          <p className="text-[11px] leading-5 text-slate-400">
            The descriptive metadata shown here is local to this browser session; it is not stored in the auction contract.
          </p>
          {chainStatus?.id === listing.id && (
            <p className="font-mono text-[11px] text-emerald-200/80">{chainStatus.line}</p>
          )}
          {connection && !isOwnListing && (currentStatus === BigInt(1) || currentStatus === BigInt(2)) && (
            <OnChainBidPanel
              listing={listing}
              connection={connection}
              revealWindow={currentStatus === BigInt(2)}
            />
          )}
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
            >
              {linkCopied ? "Link copied" : "Copy share link"}
            </button>
          {listing.transactionHash && (
            <p className="break-all font-mono text-[10px] text-emerald-200/70">Transaction {listing.transactionHash}</p>
          )}
        </div>
      ) : isOwnListing ? (
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3">
          <Ban className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            This listing belongs to your connected wallet, so bidding is disabled in this demo.
            The contract rejects bids from the listing&apos;s seller address; a second account is not blocked.
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

      {!listing.onChain && (
        <button
          onClick={onEnterBidding}
          className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{isOwnListing ? "Monitor auction" : "Enter private bidding"}</span>
        </button>
      )}
    </div>
  );
}
