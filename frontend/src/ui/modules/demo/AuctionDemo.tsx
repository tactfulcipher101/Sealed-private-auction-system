"use client";

import { useState } from "react";
import { Gavel, Tags, LogOut } from "lucide-react";
import { demoListings, type Listing, type SimulatedBid } from "@/lib/demoData";
import { WalletConnect } from "./WalletConnect";
import { ListingCatalog } from "./ListingCatalog";
import { ListingDetail } from "./ListingDetail";
import { BidCommitForm } from "./BidCommitForm";
import { LiveAuctionRoom } from "./LiveAuctionRoom";
import { SettlementReveal } from "./SettlementReveal";
import { SellAssetForm } from "./SellAssetForm";

type DemoStep = "catalog" | "sell" | "listing" | "bidding" | "live" | "settled";

export function AuctionDemo() {
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [step, setStep] = useState<DemoStep>("catalog");
  const [listings, setListings] = useState<Listing[]>(demoListings);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [userBid, setUserBid] = useState<SimulatedBid | null>(null);
  const [finalBids, setFinalBids] = useState<SimulatedBid[]>([]);
  const [justListedId, setJustListedId] = useState<string | null>(null);

  function handleSelectListing(listing: Listing) {
    setSelectedListing(listing);
    setStep("listing");
  }

  function handleListingCreated(listing: Listing) {
    setListings((current) => [listing, ...current]);
    setJustListedId(listing.id);
    setStep("catalog");
  }

  function handleBidCommitted(bid: SimulatedBid) {
    setUserBid(bid);
    setStep("live");
  }

  function handleAuctionClosed(allBids: SimulatedBid[]) {
    setFinalBids(allBids);
    setStep("settled");
  }

  function handleRestart() {
    setSelectedListing(null);
    setUserBid(null);
    setFinalBids([]);
    setJustListedId(null);
    setStep("catalog");
  }

  function handleSwitchWallet() {
    setUserWallet(null);
    setSelectedListing(null);
    setUserBid(null);
    setFinalBids([]);
    setStep("catalog");
  }

  if (!userWallet) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <WalletConnect onConnected={setUserWallet} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-8 text-xs text-slate-500">
        <span className="font-mono">Connected as {userWallet}</span>
        <button
          onClick={handleSwitchWallet}
          className="inline-flex items-center gap-1.5 hover:text-slate-300 transition-colors"
        >
          <LogOut className="h-3 w-3" /> Switch wallet
        </button>
      </div>

      {(step === "catalog" || step === "sell") && (
        <div className="flex gap-2 mb-8 p-1 rounded-lg bg-slate-900/60 border border-slate-800 w-fit mx-auto">
          <button
            onClick={() => setStep("catalog")}
            className={
              "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all " +
              (step === "catalog" ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:text-slate-200")
            }
          >
            <Gavel className="h-3.5 w-3.5" /> Browse & bid
          </button>
          <button
            onClick={() => setStep("sell")}
            className={
              "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all " +
              (step === "sell" ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:text-slate-200")
            }
          >
            <Tags className="h-3.5 w-3.5" /> List an asset
          </button>
        </div>
      )}

      {step === "catalog" && (
        <ListingCatalog
          listings={listings}
          onSelectListing={handleSelectListing}
          highlightId={justListedId}
        />
      )}

      {step === "sell" && (
        <SellAssetForm
          sellerWalletAddress={userWallet}
          onListingCreated={handleListingCreated}
          onCancel={() => setStep("catalog")}
        />
      )}

      {step === "listing" && selectedListing && (
        <ListingDetail
          listing={selectedListing}
          isOwnListing={selectedListing.sellerWalletAddress === userWallet}
          onEnterBidding={() => setStep("bidding")}
          onBack={() => setStep("catalog")}
        />
      )}

      {step === "bidding" && selectedListing && (
        <BidCommitForm
          listing={selectedListing}
          onBidCommitted={handleBidCommitted}
          onCancel={() => setStep("listing")}
        />
      )}

      {step === "live" && selectedListing && userBid && (
        <LiveAuctionRoom
          listing={selectedListing}
          userBid={userBid}
          onAuctionClosed={handleAuctionClosed}
        />
      )}

      {step === "settled" && selectedListing && (
        <SettlementReveal listing={selectedListing} bids={finalBids} onRestart={handleRestart} />
      )}
    </div>
  );
}

