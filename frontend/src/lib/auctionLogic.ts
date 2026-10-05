import type { ListingCategory } from "@/lib/demoData";

export const SETTLEMENT_FEE_BPS = 300;
export const LATE_REVEAL_PENALTY_BPS = 2000;
export const MAX_BIDS_PER_LISTING = 32;

export interface ListingPolicy {
  category: ListingCategory;
  stakeBps: number;
  legalClosingWindowSeconds: number;
  requiresVerification: boolean;
}

export function getListingPolicy(
  category: ListingCategory,
  stakeBps = 0,
  legalClosingWindowSeconds = 0,
): ListingPolicy {
  return {
    category,
    stakeBps: category === "real-estate" ? stakeBps : 0,
    legalClosingWindowSeconds: category === "real-estate" ? legalClosingWindowSeconds : 0,
    requiresVerification: true,
  };
}

export function calculateStake(amount: number, stakeBps: number) {
  return Math.floor((amount * stakeBps) / 10_000);
}

export function calculateSettlementFee(amount: number) {
  return Math.floor((amount * SETTLEMENT_FEE_BPS) / 10_000);
}

export function calculateSellerProceeds(amount: number) {
  return Math.max(0, amount - calculateSettlementFee(amount));
}

export function isBidValid(amount: number, reservePrice: number) {
  return Number.isFinite(amount) && amount > 0 && amount >= reservePrice;
}

