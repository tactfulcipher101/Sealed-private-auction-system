export interface OnChainListingMetadata {
  id: string;
  title: string;
  region: string;
  description: string;
}

// Descriptive text only. Reserve, category, stake, window and seller are read from the contract.
export const ON_CHAIN_LISTING_METADATA: OnChainListingMetadata[] = [
];
