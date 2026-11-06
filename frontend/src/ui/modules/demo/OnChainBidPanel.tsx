"use client";

import { useState } from "react";
import type { Listing } from "@/lib/demoData";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { commitBidOnChain, faucetTestTokens, revealBidOnChain, type CommittedBid } from "@/lib/sealedAuction";

const MAX_U128 = BigInt("340282366920938463463374607431768211455");

interface OnChainBidPanelProps {
  listing: Listing;
  connection: ConnectedAztecWallet;
  revealWindow: boolean;
}

export function OnChainBidPanel({ listing, connection, revealWindow }: OnChainBidPanelProps) {
  const [amountText, setAmountText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [committed, setCommitted] = useState<CommittedBid | null>(null);
  const [revealTxHash, setRevealTxHash] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [faucetText, setFaucetText] = useState("1000");
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);
  const [isFauceting, setIsFauceting] = useState(false);
  const reservePrice = BigInt(listing.reservePrice);
  const hasWholeBidAmount = /^\d{1,39}$/.test(amountText);
  const bidAmount = hasWholeBidAmount ? BigInt(amountText) : null;
  const meetsReserve = bidAmount !== null && bidAmount >= reservePrice && bidAmount <= MAX_U128;
  const bidHint = !amountText
    ? `Bid must be at least ${listing.reservePrice.toLocaleString()} ${listing.currency} (the reserve).`
    : !hasWholeBidAmount
      ? "Enter the bid as a whole number."
      : bidAmount !== null && bidAmount > MAX_U128
        ? "The bid exceeds the supported token amount."
        : `Bid must be at least ${listing.reservePrice.toLocaleString()} ${listing.currency} (the reserve).`;

  async function handleFaucet() {
    setErrorText(null);
    setFaucetStatus(null);
    if (!/^[0-9]+$/.test(faucetText)) {
      setErrorText("Enter the faucet amount as a whole number.");
      return;
    }
    setIsFauceting(true);
    try {
      const faucetTxHash = await faucetTestTokens(connection, listing.currency as Parameters<typeof faucetTestTokens>[1], BigInt(faucetText));
      setFaucetStatus("Faucet tx " + faucetTxHash);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Faucet failed.");
    } finally {
      setIsFauceting(false);
    }
  }

  async function handleCommit() {
    setErrorText(null);
    if (!hasWholeBidAmount) {
      setErrorText("Enter the bid as a whole number.");
      return;
    }
    const amount = BigInt(amountText);
    if (amount > MAX_U128) {
      setErrorText("The bid exceeds the supported token amount.");
      return;
    }
    if (amount < reservePrice) {
      setErrorText(`Bid must be at least ${listing.reservePrice.toLocaleString()} ${listing.currency}.`);
      return;
    }
    setIsSending(true);
    try {
      const result = await commitBidOnChain(connection, {
        listingId: listing.id,
        currency: listing.currency as Parameters<typeof commitBidOnChain>[1]["currency"],
        amount,
        stakeBps: listing.stakeBps,
      });
      setCommitted(result);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Bid commitment failed.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleReveal() {
    setErrorText(null);
    setIsRevealing(true);
    try {
      setRevealTxHash(await revealBidOnChain(connection, listing.id));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Bid reveal failed.");
    } finally {
      setIsRevealing(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      {revealWindow ? (
        <>
          <p className="text-xs font-medium text-slate-200">Reveal your bid from this bidder wallet</p>
          <p className="text-[11px] leading-5 text-slate-400">
            This uses the private bid note in the connected wallet. Revealing publishes the amount and commitment hash, not the bidder address. Do not enter your auction secret here.
          </p>
          <button
            type="button"
            onClick={() => void handleReveal()}
            disabled={isRevealing || revealTxHash !== null}
            className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {isRevealing ? "Waiting for wallet and proof..." : revealTxHash ? "Bid revealed" : "Reveal my bid"}
          </button>
          {revealTxHash && <p className="break-all font-mono text-[10px] text-emerald-200/80">Reveal tx {revealTxHash}</p>}
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-slate-200">Commit a sealed bid on chain (test token)</p>
          <div className="flex gap-2">
            <input type="text" inputMode="numeric" value={faucetText} onChange={(event) => setFaucetText(event.target.value)} disabled={isFauceting} className="w-24 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
            <button type="button" onClick={() => void handleFaucet()} disabled={isFauceting || isSending} className="flex-1 rounded-lg border border-slate-700 py-1 text-xs text-slate-100 disabled:opacity-50">{isFauceting ? "Minting test tokens..." : "Get test tokens"}</button>
          </div>
          {faucetStatus && <p className="break-all font-mono text-[10px] text-emerald-200/80">{faucetStatus}</p>}
          <input
            type="text"
            inputMode="numeric"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            disabled={isSending || committed !== null}
            placeholder="Bid amount, whole number"
            aria-describedby="bid-reserve-hint"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <p id="bid-reserve-hint" className="text-[11px] text-slate-400">{bidHint}</p>
          <button
            type="button"
            onClick={() => void handleCommit()}
            disabled={isSending || committed !== null || !meetsReserve}
            className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {isSending ? "Waiting for wallet and proof..." : "Commit bid"}
          </button>
        </>
      )}
      {errorText && <p className="break-words text-[11px] text-rose-300">{errorText}</p>}
      {committed && (
        <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[11px] font-semibold text-amber-100">Save these now. They are shown once and not stored. A lost salt cannot be recovered.</p>
          <pre className="overflow-x-auto text-[10px] leading-4 text-slate-200">{JSON.stringify(committed, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
