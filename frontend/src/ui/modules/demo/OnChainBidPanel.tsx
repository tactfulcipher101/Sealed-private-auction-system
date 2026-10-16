"use client";

import { useState } from "react";
import type { Listing } from "@/lib/demoData";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { commitBidOnChain, faucetTestTokens, type CommittedBid } from "@/lib/sealedAuction";

interface OnChainBidPanelProps {
  listing: Listing;
  connection: ConnectedAztecWallet;
}

export function OnChainBidPanel({ listing, connection }: OnChainBidPanelProps) {
  const [amountText, setAmountText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [committed, setCommitted] = useState<CommittedBid | null>(null);
  const [faucetText, setFaucetText] = useState("1000");
  const [faucetStatus, setFaucetStatus] = useState<string | null>(null);
  const [isFauceting, setIsFauceting] = useState(false);

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
    if (!/^[0-9]+$/.test(amountText)) {
      setErrorText("Enter the bid as a whole number.");
      return;
    }
    setIsSending(true);
    try {
      const result = await commitBidOnChain(connection, {
        listingId: listing.id,
        currency: listing.currency as Parameters<typeof commitBidOnChain>[1]["currency"],
        amount: BigInt(amountText),
        stakeBps: listing.stakeBps,
      });
      setCommitted(result);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Bid commitment failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
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
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <button
        type="button"
        onClick={() => void handleCommit()}
        disabled={isSending || committed !== null}
        className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
      >
        {isSending ? "Waiting for wallet and proof..." : "Commit bid"}
      </button>
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
