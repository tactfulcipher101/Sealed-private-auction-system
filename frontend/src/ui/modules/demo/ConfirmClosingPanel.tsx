"use client";

import { useState } from "react";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { confirmClosingOnChain } from "@/lib/sealedAuction";

interface ConfirmClosingPanelProps {
  connection: ConnectedAztecWallet;
}

export function ConfirmClosingPanel({ connection }: ConfirmClosingPanelProps) {
  const [listingIdText, setListingIdText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [confirmTxHash, setConfirmTxHash] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorText(null);
    setConfirmTxHash(null);
    setIsSending(true);
    try {
      setConfirmTxHash(await confirmClosingOnChain(connection, listingIdText.trim()));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Confirm closing failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-8 space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-medium text-slate-200">Seller: confirm legal closing</p>
      <p className="text-xs leading-5 text-slate-500">
        Only the listing seller account can submit this, only for real-estate listings, and only after the auction is settled. It lets the winning bidder claim their stake (a CLI-only claim) and moves no funds itself.
      </p>
      <input
        type="text"
        value={listingIdText}
        onChange={(event) => setListingIdText(event.target.value)}
        disabled={isSending}
        placeholder="Listing id: 0x plus 64 hex digits"
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
      />
      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={isSending || listingIdText.trim().length === 0}
        className="w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-100 disabled:opacity-50"
      >
        {isSending ? "Submitting confirm_closing..." : "Confirm closing"}
      </button>
      {confirmTxHash && <p className="break-all font-mono text-[10px] text-emerald-200/80">tx {confirmTxHash}</p>}
      {errorText && <p className="text-xs text-red-300">{errorText}</p>}
    </div>
  );
}
