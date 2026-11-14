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

const REVEALED_PREFIX = "sealed-revealed-v1:";

function revealedKey(accountAddress: string): string {
  return REVEALED_PREFIX + accountAddress.toLowerCase();
}

function readRevealed(accountAddress: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(revealedKey(accountAddress));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

// Flag only: this browser saw its own reveal succeed. No amounts, salts or secrets.
export function markBidRevealed(accountAddress: string | null | undefined, listingId: string): void {
  if (!accountAddress) return;
  try {
    const flags = readRevealed(accountAddress);
    flags[listingId.toLowerCase()] = true;
    window.localStorage.setItem(revealedKey(accountAddress), JSON.stringify(flags));
  } catch {
    // Storage blocked or full: the reveal still happened on chain.
  }
}

export function loadBidRevealed(accountAddress: string | null | undefined, listingId: string): boolean {
  if (!accountAddress) return false;
  return readRevealed(accountAddress)[listingId.toLowerCase()] === true;
}
