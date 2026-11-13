const STORAGE_PREFIX = "sealed-bids-v1:";

function storageKey(accountAddress: string): string {
  return STORAGE_PREFIX + accountAddress.toLowerCase();
}

function readRecords(accountAddress: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(storageKey(accountAddress));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Own bid amount only. Never store salts, bid boxes or the auction secret here.
export function saveBidRecord(accountAddress: string | null | undefined, listingId: string, amount: string): void {
  if (!accountAddress) return;
  try {
    const records = readRecords(accountAddress);
    records[listingId.toLowerCase()] = amount;
    window.localStorage.setItem(storageKey(accountAddress), JSON.stringify(records));
  } catch {
    // Storage blocked or full: the bid still exists on chain, it just is not remembered here.
  }
}

export function loadBidRecord(accountAddress: string | null | undefined, listingId: string): string | null {
  if (!accountAddress) return null;
  const value = readRecords(accountAddress)[listingId.toLowerCase()];
  return typeof value === "string" && /^[0-9]{1,39}$/.test(value) ? value : null;
}
