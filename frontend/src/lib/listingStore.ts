import type { Listing } from "@/lib/demoData";

const STORAGE_PREFIX = "sealed-listings-v1:";

function storageKey(accountAddress: string): string {
  return STORAGE_PREFIX + accountAddress.toLowerCase();
}

// Public listing fields only. Never store salts, bid boxes or the auction secret here.
export function loadSavedListings(accountAddress: string): Listing[] {
  try {
    const raw = window.localStorage.getItem(storageKey(accountAddress));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is Listing =>
        typeof entry === "object" && entry !== null &&
        typeof (entry as Listing).id === "string" && typeof (entry as Listing).title === "string",
    );
  } catch {
    return [];
  }
}

export function saveListing(accountAddress: string, listing: Listing): void {
  try {
    const existing = loadSavedListings(accountAddress).filter((entry) => entry.id !== listing.id);
    window.localStorage.setItem(storageKey(accountAddress), JSON.stringify([listing, ...existing]));
  } catch {
    // Storage blocked or full: the page still works, the listing just is not remembered.
  }
}
