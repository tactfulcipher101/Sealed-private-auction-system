import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/foundation/curves/bn254";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import { getConfiguredChainInfo, type ConnectedAztecWallet } from "@/lib/aztecWallet";
import type { Listing } from "@/lib/demoData";
import { getNetworkConfig, type SupportedCurrency } from "@/lib/network";

export type AuctionArtifact = ContractArtifact & {
  aztec_version?: string;
  functions?: Array<{ name: string }>;
};

let artifactPromise: Promise<AuctionArtifact> | null = null;

export function getSealedAuctionFunctionNames(artifact: AuctionArtifact): Set<string> {
  return new Set((artifact.functions ?? []).map((entry) => entry.name));
}

export async function getSealedAuctionArtifact(): Promise<AuctionArtifact> {
  if (!artifactPromise) {
    artifactPromise = fetch("/artifacts/sealed_auction-SealedAuction.json")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Compiled auction artifact is unavailable. Run aztec compile --workspace and restart the frontend.");
        }
        return await response.json() as AuctionArtifact;
      })
      .catch((error: unknown) => {
        artifactPromise = null;
        throw error;
      });
  }
  return artifactPromise;
}

export async function hasSealedAuctionFunction(functionName: string): Promise<boolean> {
  const artifact = await getSealedAuctionArtifact();
  return getSealedAuctionFunctionNames(artifact).has(functionName);
}

export async function assertSealedAuctionFunction(functionName: string): Promise<void> {
  if (!(await hasSealedAuctionFunction(functionName))) {
    throw new Error(`Function "${functionName}" is not available in this contract version.`);
  }
}

export function validateListingCategoryRules(
  category: Listing["category"],
  stakeBps: number,
  legalClosingWindowSeconds: number,
): string | null {
  if (category === "real-estate") {
    if (stakeBps <= 0 || stakeBps > 10000) {
      return "Real-estate listings require a stake greater than zero and at most 100 percent.";
    }
    if (legalClosingWindowSeconds <= 0) {
      return "Real-estate listings require a positive legal closing window.";
    }
    return null;
  }

  if (stakeBps !== 0 || legalClosingWindowSeconds !== 0) {
    return "Mobile goods listings must set stake and legal closing window to zero.";
  }
  return null;
}

export function configuredAddress(value: string | null, label: string) {
  if (!value) throw new Error(`${label} is not configured for this network.`);
  try {
    return AztecAddress.schema.parse(value);
  } catch {
    throw new Error(`${label} is not a valid Aztec address.`);
  }
}

export async function getAssetVerifier(connection: ConnectedAztecWallet): Promise<AztecAddress> {
  await assertSealedAuctionFunction("get_asset_verifier");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const result = await (auction.methods as Record<string, any>).get_asset_verifier().simulate({ from: connectedAddress });
  return AztecAddress.schema.parse(result.result);
}

export interface CreateListingInput {
  title: string;
  category: Listing["category"];
  region: string;
  description: string;
  reservePrice: number;
  currency: SupportedCurrency;
  stakeBps: number;
  legalClosingWindowSeconds: number;
  closeTimestamp: number;
  revealDeadline: number;
  imageUrls: string[];
  sellerAddress: string;
}

export async function createVerifiedListing(
  connection: ConnectedAztecWallet,
  input: CreateListingInput,
): Promise<Listing> {
  await assertSealedAuctionFunction("create_listing");
  const config = getNetworkConfig();
  const artifact = await getSealedAuctionArtifact();
  const expectedChain = await getConfiguredChainInfo();
  const connectedChain = await connection.wallet.getChainInfo();
  if (!connectedChain.chainId.equals(expectedChain.chainId) || !connectedChain.version.equals(expectedChain.version)) {
    throw new Error("Connected wallet is on a different Aztec network than the configured node.");
  }

  const verifierAddress = configuredAddress(config.assetVerifierAddress, "Asset verifier");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  if (!connectedAddress.equals(verifierAddress)) {
    throw new Error("Only the configured asset-verifier account can create listings.");
  }

  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const sellerAddress = configuredAddress(input.sellerAddress, "Seller account");
  const tokenAddress = configuredAddress(config.tokenAddresses[input.currency] ?? null, `${input.currency} token`);
  const onchainVerifier = await getAssetVerifier(connection);
  if (!onchainVerifier.equals(verifierAddress)) {
    throw new Error("Configured asset verifier does not match the deployed contract verifier.");
  }

  const categoryValidation = validateListingCategoryRules(input.category, input.stakeBps, input.legalClosingWindowSeconds);
  if (categoryValidation) {
    throw new Error(categoryValidation);
  }

  const listingId = Fr.random();
  const categoryId = input.category === "real-estate" ? 1 : 0;
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const { receipt } = await (auction.methods as Record<string, any>).create_listing(
    listingId,
    tokenAddress,
    BigInt(input.reservePrice),
    BigInt(input.closeTimestamp),
    BigInt(input.revealDeadline),
    sellerAddress,
    categoryId,
    input.stakeBps,
    BigInt(input.legalClosingWindowSeconds),
  ).send({ from: connectedAddress });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? "The listing transaction did not execute successfully.");
  }

  return {
    id: listingId.toString(),
    title: input.title,
    category: input.category,
    region: input.region,
    description: input.description,
    reservePrice: input.reservePrice,
    stakeBps: input.stakeBps,
    legalClosingWindowSeconds: input.legalClosingWindowSeconds,
    currency: input.currency,
    verifiedBy: "Configured on-chain asset verifier",
    sellerWalletAddress: sellerAddress.toString(),
    onChain: true,
    imageUrls: input.imageUrls,
    transactionHash: receipt.txHash.toString(),
  };
}
