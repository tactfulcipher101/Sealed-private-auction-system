export interface OnChainListingMetadata {
  id: string;
  title: string;
  region: string;
  description: string;
}

// Descriptive text only. Reserve, category, stake, window and seller are read from the contract.
export const ON_CHAIN_LISTING_METADATA: OnChainListingMetadata[] = [
  {
    id: "0x18f49245e7ef20fa0982c44e74b310e1a0d5d49e5550f7863076d6cbb6c2a799",
    title: "Test real estate listing",
    region: "Testnet",
    description: "Testnet listing used to exercise commit, reveal, settlement and closing confirmation. Not a real asset.",
  },
  {
    id: "0x0a24fe00c054166ec036d55acf732858702e7a213a6d1a5794ae2bcb241b3990",
    title: "Test mobile goods listing",
    region: "Testnet",
    description: "Testnet listing used to exercise commit, reveal, settlement and claims. Not a real asset.",
  },
];
