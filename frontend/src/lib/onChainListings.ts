export interface OnChainListingMetadata {
  id: string;
  title: string;
  region: string;
  description: string;
}

// Descriptive text only. Reserve, category, stake, window and seller are read from the contract.
export const ON_CHAIN_LISTING_METADATA: OnChainListingMetadata[] = [
  {
    id: "0x0000000000000000000000000000000000000000000000000000000000007701",
    title: "Test mobile goods listing",
    region: "Testnet",
    description: "Testnet listing used to exercise commit, reveal, settlement and claims. Not a real asset.",
  },
];
