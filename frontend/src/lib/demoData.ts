export type ListingCategory = "real-estate" | "mobile-goods";

export interface Listing {
  id: string;
  title: string;
  category: ListingCategory;
  region: string;
  description: string;
  reservePrice: number;
  currency: "USDC" | "USDT" | "cNGN" | "EURC";
  verifiedBy: string;
  sellerWalletAddress: string;
  imageUrls?: string[];
}

export interface SimulatedBid {
  walletAddress: string;
  commitmentHash: string;
  amount: number;
  currency: string;
  isUser: boolean;
  submittedAt: number;
}

export const demoListings: Listing[] = [
  {
    id: "lst-001",
    title: "Three-bedroom waterfront duplex",
    category: "real-estate",
    region: "Lekki Phase 1, Lagos",
    description:
      "Fully serviced duplex with private jetty access. Listed following an estate liquidation.",
    reservePrice: 185000,
    currency: "cNGN",
    verifiedBy: "NIESV-registered surveyor",
    sellerWalletAddress: "0x7a41...9c2e",
  },
  {
    id: "lst-002",
    title: "1961 Patek Philippe Calatrava, ref. 2526",
    category: "mobile-goods",
    region: "Held in Geneva",
    description:
      "Manual-wind, rose gold case. Condition and provenance verified prior to listing.",
    reservePrice: 42000,
    currency: "USDC",
    verifiedBy: "Real Authentication",
    sellerWalletAddress: "0xb318...44f0",
  },
  {
    id: "lst-003",
    title: "Four-unit residential block",
    category: "real-estate",
    region: "Maitama, Abuja",
    description: "Fully tenanted, sold as a single lot due to a corporate wind-down.",
    reservePrice: 310000,
    currency: "USDT",
    verifiedBy: "ESVARBON-registered valuer",
    sellerWalletAddress: "0x2e6d...d17a",
  },
  {
    id: "lst-004",
    title: "Cartier Crash bracelet, 18k gold",
    category: "mobile-goods",
    region: "Held in London",
    description: "Vintage piece, single prior owner. Authentication on file.",
    reservePrice: 28500,
    currency: "EURC",
    verifiedBy: "Real Authentication",
    sellerWalletAddress: "0xf90c...7b21",
  },
];
