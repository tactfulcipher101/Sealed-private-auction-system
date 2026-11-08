"use client";

import { useState } from "react";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { closeAuctionOnChain, finalizeSettlementOnChain } from "@/lib/sealedAuction";

interface SettlementStepsPanelProps {
  connection: ConnectedAztecWallet;
}

export function SettlementStepsPanel({ connection }: SettlementStepsPanelProps) {
  const [listingIdText, setListingIdText] = useState("");
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);

  async function runStep(stepName: "close" | "finalize") {
    setErrorText(null);
    setResultText(null);
    setActiveStep(stepName);
    try {
      const listingIdHex = listingIdText.trim();
      const txHash = stepName === "close"
        ? await closeAuctionOnChain(connection, listingIdHex)
        : await finalizeSettlementOnChain(connection, listingIdHex);
      setResultText(stepName + " tx " + txHash);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setActiveStep(null);
    }
  }

  const isBusy = activeStep !== null;
  const hasId = listingIdText.trim().length > 0;

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-medium text-slate-200">Anyone: close and finalize an auction</p>
      <p className="text-xs leading-5 text-slate-500">
        Close works once the close time has passed. Finalize works after the reveal deadline, or once every bid is revealed. Neither moves funds. Winner, loser and late-reveal claims are CLI-only for now.
      </p>
      <input
        type="text"
        value={listingIdText}
        onChange={(event) => setListingIdText(event.target.value)}
        disabled={isBusy}
        placeholder="Listing id, 0x-prefixed hex"
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void runStep("close")}
          disabled={isBusy || !hasId}
          className="rounded-lg border border-slate-700 py-2 text-xs text-slate-100 disabled:opacity-50"
        >
          {activeStep === "close" ? "Submitting..." : "Close auction"}
        </button>
        <button
          type="button"
          onClick={() => void runStep("finalize")}
          disabled={isBusy || !hasId}
          className="rounded-lg border border-slate-700 py-2 text-xs text-slate-100 disabled:opacity-50"
        >
          {activeStep === "finalize" ? "Submitting..." : "Finalize settlement"}
        </button>
      </div>
      {resultText && <p className="break-all font-mono text-[10px] text-emerald-200/80">{resultText}</p>}
      {errorText && <p className="text-xs text-red-300">{errorText}</p>}
    </div>
  );
}
