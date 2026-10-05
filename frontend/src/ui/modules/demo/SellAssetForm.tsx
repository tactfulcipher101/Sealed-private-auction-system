"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ShieldCheck, Loader2, ImagePlus, X } from "lucide-react";
import type { Listing, ListingCategory } from "@/lib/demoData";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { createVerifiedListing, validateListingCategoryRules } from "@/lib/auctionClient";
import { getNetworkConfig, type SupportedCurrency } from "@/lib/network";

interface SellAssetFormProps {
  connection: ConnectedAztecWallet;
  onListingCreated: (listing: Listing) => void;
  onCancel: () => void;
}

const MAX_IMAGES = 4;

export function SellAssetForm({ connection, onListingCreated, onCancel }: SellAssetFormProps) {
  const config = getNetworkConfig();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ListingCategory>("real-estate");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const availableCurrencies = Object.keys(config.tokenAddresses) as SupportedCurrency[];
  const [currency, setCurrency] = useState<SupportedCurrency>(availableCurrencies[0] ?? "USDC");
  const [sellerAddress, setSellerAddress] = useState("");
  const [stakePercent, setStakePercent] = useState("10");
  const [legalClosingDays, setLegalClosingDays] = useState("7");
  const [closeAfterHours, setCloseAfterHours] = useState("24");
  const [revealWindowHours, setRevealWindowHours] = useState("24");
  const [operatorAttestation, setOperatorAttestation] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConfiguredVerifier = Boolean(
    config.assetVerifierAddress &&
    connection.address.toLowerCase() === config.assetVerifierAddress.toLowerCase()
  );
  const hasSelectedToken = Boolean(config.tokenAddresses[currency]);

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    const remainingSlots = MAX_IMAGES - imagePreviews.length;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews((current) => [...current, ...newPreviews]);
    event.target.value = "";
  }

  function handleRemoveImage(index: number) {
    setImagePreviews((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target);
      return current.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsedReserve = Number(reservePrice);
    const parsedStakePercent = Number(stakePercent);
    const parsedClosingDays = Number(legalClosingDays);
    const parsedCloseHours = Number(closeAfterHours);
    const parsedRevealHours = Number(revealWindowHours);
    if (!title.trim() || !region.trim() || !description.trim() || !sellerAddress.trim() || !Number.isSafeInteger(parsedReserve) || parsedReserve <= 0) {
      setError("Complete the listing details, seller address, and positive reserve price.");
      return;
    }
    if (!operatorAttestation) {
      setError("Confirm the asset has been verified before submitting the operator attestation.");
      return;
    }
    if (!Number.isSafeInteger(parsedCloseHours) || !Number.isSafeInteger(parsedRevealHours) || parsedCloseHours < 1 || parsedRevealHours < 1) {
      setError("Closing and reveal windows must be positive whole numbers of hours.");
      return;
    }
    const categoryStakeBps = category === "real-estate" ? Math.round(parsedStakePercent * 100) : 0;
    const categoryClosingWindow = category === "real-estate" ? parsedClosingDays * 86400 : 0;
    const categoryError = validateListingCategoryRules(category, categoryStakeBps, categoryClosingWindow);
    if (categoryError) {
      setError(categoryError);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const closeTimestamp = now + parsedCloseHours * 3600;
    const revealDeadline = closeTimestamp + parsedRevealHours * 3600;
    setIsSubmitting(true);
    try {
      const listing = await createVerifiedListing(connection, {
        title: title.trim(),
        category,
        region: region.trim(),
        description: description.trim(),
        sellerAddress: sellerAddress.trim(),
        reservePrice: parsedReserve,
        currency,
        stakeBps: category === "real-estate" ? Math.round(parsedStakePercent * 100) : 0,
        legalClosingWindowSeconds: category === "real-estate" ? parsedClosingDays * 86400 : 0,
        closeTimestamp,
        revealDeadline,
        imageUrls: imagePreviews,
      });
      onListingCreated(listing);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Listing transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
      </button>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-100">Create verified listing</h2>
        <p className="text-sm text-slate-400">
          This submits a real transaction. The connected verifier account is attesting that the off-chain asset review is complete; no verification partner is contacted by this app.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          TEST-ONLY token fixture: this app only supports the local test token. It is not a stablecoin, and it is not for production use.
        </p>
        <p className="text-xs leading-5 text-slate-500">
          The contract stores the seller, token, reserve, schedule, category, and stake terms. Title, description, region, and photos stay in this browser session and are not published by this transaction.
        </p>
      </div>

      <div className={"rounded-lg border p-4 text-xs leading-5 " + (isConfiguredVerifier && hasSelectedToken ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-100/80" : "border-amber-500/25 bg-amber-500/5 text-amber-100/80")}>
        {isConfiguredVerifier
          ? hasSelectedToken
            ? `Submitting as the configured asset verifier on ${config.label}.`
            : `Configure a deployed settlement-token address for ${config.label} before listing.`
          : "This wallet is not the configured asset verifier. Connect with the verifier account to submit an on-chain listing."}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Photos</label>
          <div className="grid grid-cols-4 gap-2">
            {imagePreviews.map((url, index) => (
              <div key={url} className="relative aspect-square">
                <img
                  src={url}
                  alt={"Upload " + (index + 1)}
                  className="w-full h-full object-cover rounded-lg border border-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {imagePreviews.length < MAX_IMAGES && (
              <label className="aspect-square rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300 hover:border-slate-600 cursor-pointer transition-colors">
                <ImagePlus className="h-4 w-4" />
                <span className="text-[10px]">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Up to {MAX_IMAGES} photos. Stored only in this browser session for the demo.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Asset title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Four-bedroom detached house"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-300">Seller Aztec address</label>
          <input
            type="text"
            value={sellerAddress}
            onChange={(event) => setSellerAddress(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ListingCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-sm text-slate-100 focus:outline-none focus:border-slate-500 transition-colors"
            >
              <option value="real-estate">Real estate</option>
              <option value="mobile-goods">Mobile / luxury goods</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Ikoyi, Lagos"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Condition, provenance, why it's being sold"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Reserve price
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              placeholder="e.g. 150000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Listing["currency"])}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-sm text-slate-100 focus:outline-none focus:border-slate-500 transition-colors"
            >
              {availableCurrencies.map((asset) => <option key={asset} value={asset}>{asset}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">Auction closes in (hours)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={closeAfterHours}
              onChange={(event) => setCloseAfterHours(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">Reveal window (hours)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={revealWindowHours}
              onChange={(event) => setRevealWindowHours(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
        </div>

        {category === "real-estate" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">Winner stake (%)</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={stakePercent}
                onChange={(event) => setStakePercent(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">Legal closing window (days)</label>
              <input
                type="number"
                min="1"
                value={legalClosingDays}
                onChange={(event) => setLegalClosingDays(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100/90">
          <input
            type="checkbox"
            checked={operatorAttestation}
            onChange={(event) => setOperatorAttestation(event.target.checked)}
            className="mt-1 accent-amber-400"
          />
          <span>I am the configured asset verifier and confirm that the seller’s ownership and asset review have been completed off-chain. This transaction records my operator attestation; it does not independently prove the review.</span>
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isConfiguredVerifier || !hasSelectedToken || availableCurrencies.length === 0}
          className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isSubmitting ? "Waiting for Aztec transaction..." : "Attest and create listing on-chain"}
        </button>
      </form>
    </div>
  );
}
