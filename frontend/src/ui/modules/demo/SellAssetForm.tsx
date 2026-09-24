"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, ShieldCheck, Loader2, ImagePlus, X } from "lucide-react";
import type { Listing, ListingCategory } from "@/lib/demoData";

interface SellAssetFormProps {
  sellerWalletAddress: string;
  onListingCreated: (listing: Listing) => void;
  onCancel: () => void;
}

const VERIFICATION_STAGES = [
  "Connecting wallet...",
  "Generating ZK identity proof (no documents leave your device)...",
  "Routing to accredited verification partner...",
  "Partner sign-off received. Minting listing...",
];

const MAX_IMAGES = 4;

export function SellAssetForm({ sellerWalletAddress, onListingCreated, onCancel }: SellAssetFormProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ListingCategory>("real-estate");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [currency, setCurrency] = useState<Listing["currency"]>("USDC");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [isVerifying, setIsVerifying] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isVerifying) return;
    if (stageIndex >= VERIFICATION_STAGES.length - 1) return;
    const timer = setTimeout(() => setStageIndex((i) => i + 1), 700);
    return () => clearTimeout(timer);
  }, [isVerifying, stageIndex]);

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedReserve = Number(reservePrice);
    if (!title || !region || !description || !parsedReserve) return;

    setIsVerifying(true);
    setStageIndex(0);

    setTimeout(() => {
      onListingCreated({
        id: "lst-" + Math.random().toString(16).slice(2, 10),
        title,
        category,
        region,
        description,
        reservePrice: parsedReserve,
        currency,
        verifiedBy:
          category === "real-estate"
            ? "NIESV-registered surveyor (simulated)"
            : "Real Authentication (simulated)",
        sellerWalletAddress,
        imageUrls: imagePreviews,
      });
    }, VERIFICATION_STAGES.length * 700 + 400);
  }

  if (isVerifying) {
    return (
      <div className="space-y-6 text-center py-12">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
        <div className="space-y-1">
          <p className="text-sm text-slate-200 font-medium">{VERIFICATION_STAGES[stageIndex]}</p>
          <p className="text-xs text-slate-500">
            Your identity documents are never uploaded to the protocol.
          </p>
        </div>
      </div>
    );
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
        <h2 className="text-xl font-bold text-slate-100">List an asset for sale</h2>
        <p className="text-sm text-slate-400">
          Only what you enter below becomes public. Your wallet and identity stay off the
          catalog.
        </p>
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
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="cNGN">cNGN</option>
              <option value="EURC">EURC</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" /> Submit for verification
        </button>
      </form>
    </div>
  );
}
