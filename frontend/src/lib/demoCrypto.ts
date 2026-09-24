const HEX_CHARS = "0123456789abcdef";

function randomHex(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)];
  }
  return result;
}

export function generateWalletAddress(): string {
  return "0x" + randomHex(4) + "..." + randomHex(4);
}

export function generateCommitmentHash(): string {
  return "0x" + randomHex(8) + "..." + randomHex(6);
}

export function formatCurrency(amount: number, currency: string): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " " + currency;
}

export function randomBidAmount(reservePrice: number): number {
  const minMultiplier = 1.02;
  const maxMultiplier = 1.55;
  const multiplier = minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
  return Math.round((reservePrice * multiplier) / 50) * 50;
}
