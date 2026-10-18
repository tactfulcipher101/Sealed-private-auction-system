import { Contract } from "@aztec/aztec.js/contracts";
import type { AppCapabilities } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { getStandardHandshakeRegistry } from "@aztec/standard-contracts/handshake-registry/lazy";
import { STANDARD_HANDSHAKE_REGISTRY_ADDRESS } from "@aztec/standard-contracts/handshake-registry/constants";
import { Fr } from "@aztec/foundation/curves/bn254";
import { getAllFunctionAbis, loadContractArtifact, type ContractArtifact, type FunctionCall } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import { getConfiguredChainInfo, type ConnectedAztecWallet } from "@/lib/aztecWallet";
import type { Listing } from "@/lib/demoData";
import { getNetworkConfig, type SupportedCurrency } from "@/lib/network";
import { ON_CHAIN_LISTING_METADATA } from "@/lib/onChainListings";

export type AuctionArtifact = ContractArtifact & {
  aztec_version?: string;
  functions?: Array<{ name: string }>;
};

let artifactPromise: Promise<AuctionArtifact> | null = null;

export function getSealedAuctionFunctionNames(artifact: AuctionArtifact): Set<string> {
  return new Set(getAllFunctionAbis(artifact).map((entry) => entry.name));
}

export async function getSealedAuctionArtifact(): Promise<AuctionArtifact> {
  if (!artifactPromise) {
    artifactPromise = fetch("/artifacts/sealed_auction-SealedAuction.json")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Compiled auction artifact is unavailable. Run aztec compile --workspace and restart the frontend.");
        }
        return loadContractArtifact(await response.json()) as AuctionArtifact;
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

interface SealedAuctionMethods {
  get_status: (listing_id: Fr) => {
    simulate: (options: { from: AztecAddress }) => Promise<{ result: unknown }>;
  };
  get_listing: (listing_id: Fr) => {
    simulate: (options: { from: AztecAddress }) => Promise<{ result: unknown }>;
  };
  get_asset_verifier: () => {
    simulate: (options: { from: AztecAddress }) => Promise<{ result: unknown }>;
  };
  confirm_closing: (listing_id: Fr) => {
    send: (options: { from: AztecAddress }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
  close_auction: (listing_id: Fr) => {
    send: (options: { from: AztecAddress }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
  finalize_settlement: (listing_id: Fr) => {
    send: (options: { from: AztecAddress }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
  create_listing: (...args: unknown[]) => {
    send: (options: { from: AztecAddress }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
}

const walletsWithAuctionRegistered = new WeakSet<object>();

async function registerAuctionWithWallet(connection: ConnectedAztecWallet, artifact: AuctionArtifact, auctionAddress: AztecAddress): Promise<void> {
  if (walletsWithAuctionRegistered.has(connection.wallet)) return;
  const config = getNetworkConfig();
  if (!config.nodeUrl) throw new Error("Node URL is not configured.");
  const instance = await createAztecNodeClient(config.nodeUrl).getContract(auctionAddress);
  if (!instance) throw new Error("The auction contract instance was not found on the configured node.");
  await connection.wallet.registerContract(instance, artifact);
  walletsWithAuctionRegistered.add(connection.wallet);
}

export async function getAssetVerifier(connection: ConnectedAztecWallet): Promise<AztecAddress> {
  await assertSealedAuctionFunction("get_asset_verifier");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  await registerAuctionWithWallet(connection, artifact, auctionAddress);
  const result = await (auction.methods as unknown as SealedAuctionMethods).get_asset_verifier().simulate({ from: connectedAddress });
  const verifierResult = result.result;
  if (typeof verifierResult === "string") return AztecAddress.schema.parse(verifierResult);
  return verifierResult as AztecAddress;
}

export function buildCapabilityManifest(): AppCapabilities {
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const tokenAddresses = Object.values(config.tokenAddresses)
    .filter((value): value is string => Boolean(value))
    .map((value) => configuredAddress(value, "Token"));
  return {
    version: "1.0",
    metadata: { name: "Sealed private auction", version: "0.1.0" },
    capabilities: [
      { type: "accounts", canGet: true, canCreateAuthWit: true },
      { type: "contracts", contracts: [auctionAddress, ...tokenAddresses, STANDARD_HANDSHAKE_REGISTRY_ADDRESS], canRegister: true, canGetMetadata: true },
      {
        type: "simulation",
        transactions: { scope: [{ contract: auctionAddress, function: "*" }, ...tokenAddresses.map((tokenAddress) => ({ contract: tokenAddress, function: "*" }))] },
        utilities: { scope: [{ contract: auctionAddress, function: "*" }, ...tokenAddresses.map((tokenAddress) => ({ contract: tokenAddress, function: "*" }))] },
      },
      {
        type: "transaction",
        scope: [
          ...[
            "create_listing",
            "commit_bid",
            "close_auction",
            "reveal_bid",
            "reveal_bid_for",
            "finalize_settlement",
            "claim_winning_bid",
            "claim_losing_bid",
              "confirm_closing",
          ].map((functionName) => ({ contract: auctionAddress, function: functionName })),
          ...tokenAddresses.map((tokenAddress) => ({ contract: tokenAddress, function: "faucet" })),
        ],
      },
    ],
  };
}

export interface OnChainListingState {
  status: bigint;
  statusLabel: string;
  verified: boolean;
  closeTimestamp: bigint;
}

const LISTING_STATUS_LABELS: Record<string, string> = {
  "1": "open for commitments",
  "2": "reveal window",
  "3": "settled",
};

export async function readListingOnChain(connection: ConnectedAztecWallet, listingId: Fr): Promise<OnChainListingState> {
  await assertSealedAuctionFunction("get_status");
  await assertSealedAuctionFunction("get_listing");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const methods = auction.methods as unknown as SealedAuctionMethods;
  const statusResult = await methods.get_status(listingId).simulate({ from: connectedAddress });
  const listingResult = await methods.get_listing(listingId).simulate({ from: connectedAddress });

  const status = statusResult.result;
  const listingInfo = listingResult.result as { verified?: unknown; close_timestamp?: unknown } | null | undefined;
  if (typeof status !== "bigint") {
    throw new Error("get_status returned an unexpected value.");
  }
  if (!listingInfo || typeof listingInfo.verified !== "boolean" || typeof listingInfo.close_timestamp !== "bigint") {
    throw new Error("get_listing returned an unexpected value.");
  }
  return {
    status,
    statusLabel: LISTING_STATUS_LABELS[status.toString()] ?? `unknown (${status})`,
    verified: listingInfo.verified,
    closeTimestamp: listingInfo.close_timestamp,
  };
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

  await registerAuctionWithWallet(connection, artifact, auctionAddress);
  const listingId = Fr.random();
  const categoryId = input.category === "real-estate" ? BigInt(1) : BigInt(0);
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const { receipt } = await (auction.methods as unknown as SealedAuctionMethods).create_listing(
    listingId,
    tokenAddress,
    BigInt(input.reservePrice),
    BigInt(input.closeTimestamp),
    BigInt(input.revealDeadline),
    sellerAddress,
    categoryId,
    BigInt(input.stakeBps),
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

let privateTokenArtifactPromise: Promise<ContractArtifact> | null = null;

async function getPrivateTokenArtifact(): Promise<ContractArtifact> {
  if (!privateTokenArtifactPromise) {
    privateTokenArtifactPromise = fetch("/artifacts/private_token-PrivateToken.json")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Compiled token artifact is unavailable. Run aztec compile --workspace and restart the frontend.");
        }
        return loadContractArtifact(await response.json());
      })
      .catch((error: unknown) => {
        privateTokenArtifactPromise = null;
        throw error;
      });
  }
  return privateTokenArtifactPromise;
}

interface PrivateTokenPullMethods {
  transfer_in_private: (from: AztecAddress, to: AztecAddress, amount: bigint, authwitNonce: Fr) => {
    getFunctionCall: () => Promise<FunctionCall>;
  };
}

interface CommitBidMethods {
  commit_bid: (listingId: Fr, amount: bigint, salt: Fr, tokenAuthwitNonce: Fr) => {
    send: (options: { from: AztecAddress; authWitnesses: AuthWitness[] }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
}

export interface CommittedBid {
  listingId: string;
  amount: string;
  salt: string;
  tokenAuthwitNonce: string;
  transactionHash: string;
}

/**
 * Commits a sealed bid on chain. The caller must keep amount and salt: reveal_bid_for needs both and a lost salt cannot be recovered.
 * The token authwit lets the auction pull amount plus stake from the bidder through transfer_in_private.
 */
const walletsWithTokensRegistered = new WeakMap<object, Set<string>>();

async function registerTokenWithWallet(connection: ConnectedAztecWallet, artifact: ContractArtifact, tokenAddress: AztecAddress): Promise<void> {
  const registeredForWallet = walletsWithTokensRegistered.get(connection.wallet) ?? new Set<string>();
  const tokenKey = tokenAddress.toString();
  if (registeredForWallet.has(tokenKey)) return;
  const config = getNetworkConfig();
  if (!config.nodeUrl) throw new Error("Node URL is not configured.");
  const instance = await createAztecNodeClient(config.nodeUrl).getContract(tokenAddress);
  if (!instance) throw new Error("The token contract instance was not found on the configured node.");
  await connection.wallet.registerContract(instance, artifact);
  registeredForWallet.add(tokenKey);
  walletsWithTokensRegistered.set(connection.wallet, registeredForWallet);
}

interface FaucetMethods {
  faucet: (amount: bigint) => {
    send: (options: { from: AztecAddress }) => Promise<{
      receipt: { hasExecutionSucceeded: () => boolean; error?: string; txHash: { toString: () => string } };
    }>;
  };
}

const walletsWithHandshakeRegistered = new WeakSet<object>();

async function registerHandshakeRegistryWithWallet(connection: ConnectedAztecWallet): Promise<void> {
  if (walletsWithHandshakeRegistered.has(connection.wallet)) return;
  const standardRegistry = await getStandardHandshakeRegistry();
  await connection.wallet.registerContract(standardRegistry.instance, standardRegistry.artifact);
  walletsWithHandshakeRegistered.add(connection.wallet);
}

export async function faucetTestTokens(connection: ConnectedAztecWallet, currency: SupportedCurrency, amount: bigint): Promise<string> {
  if (amount <= BigInt(0)) throw new Error("Faucet amount must be positive.");
  const config = getNetworkConfig();
  const tokenAddress = configuredAddress(config.tokenAddresses[currency] ?? null, `${currency} token`);
  const bidderAddress = configuredAddress(connection.address, "Connected account");
  const tokenArtifact = await getPrivateTokenArtifact();
  await registerTokenWithWallet(connection, tokenArtifact, tokenAddress);
  const token = Contract.at(tokenAddress, tokenArtifact, connection.wallet);
  await registerHandshakeRegistryWithWallet(connection);
  const { receipt } = await (token.methods as unknown as FaucetMethods).faucet(amount).send({ from: bidderAddress });
  if (!receipt.hasExecutionSucceeded()) throw new Error(receipt.error ?? "The faucet transaction did not execute successfully.");
  return receipt.txHash.toString();
}

export async function commitBidOnChain(
  connection: ConnectedAztecWallet,
  input: { listingId: string; currency: SupportedCurrency; amount: bigint; stakeBps: number },
): Promise<CommittedBid> {
  await assertSealedAuctionFunction("commit_bid");
  if (input.amount <= BigInt(0)) throw new Error("Bid amount must be positive.");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const tokenAddress = configuredAddress(config.tokenAddresses[input.currency] ?? null, `${input.currency} token`);
  const bidderAddress = configuredAddress(connection.address, "Connected account");

  const stake = input.amount * BigInt(input.stakeBps) / BigInt(10000);
  const totalLocked = input.amount + stake;
  const listingId = Fr.fromString(input.listingId);
  const salt = Fr.random();
  const tokenAuthwitNonce = Fr.random();

  const [auctionArtifact, tokenArtifact] = await Promise.all([getSealedAuctionArtifact(), getPrivateTokenArtifact()]);
  const token = Contract.at(tokenAddress, tokenArtifact, connection.wallet);
  const auction = Contract.at(auctionAddress, auctionArtifact, connection.wallet);
  await registerAuctionWithWallet(connection, auctionArtifact, auctionAddress);
  await registerHandshakeRegistryWithWallet(connection);
  await registerTokenWithWallet(connection, tokenArtifact, tokenAddress);

  const pullCall = await (token.methods as unknown as PrivateTokenPullMethods)
    .transfer_in_private(bidderAddress, auctionAddress, totalLocked, tokenAuthwitNonce)
    .getFunctionCall();
  const tokenAuthwit = await connection.wallet.createAuthWit(bidderAddress, { caller: auctionAddress, call: pullCall });

  const { receipt } = await (auction.methods as unknown as CommitBidMethods)
    .commit_bid(listingId, input.amount, salt, tokenAuthwitNonce)
    .send({ from: bidderAddress, authWitnesses: [tokenAuthwit] });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? "The bid commitment transaction did not execute successfully.");
  }
  return {
    listingId: input.listingId,
    amount: input.amount.toString(),
    salt: salt.toString(),
    tokenAuthwitNonce: tokenAuthwitNonce.toString(),
    transactionHash: receipt.txHash.toString(),
  };
}

export async function confirmClosingOnChain(connection: ConnectedAztecWallet, listingIdHex: string): Promise<string> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(listingIdHex)) {
    throw new Error("Listing id must be 0x followed by 64 hex characters.");
  }
  await assertSealedAuctionFunction("confirm_closing");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  await registerAuctionWithWallet(connection, artifact, auctionAddress);
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const { receipt } = await (auction.methods as unknown as SealedAuctionMethods)
    .confirm_closing(Fr.fromString(listingIdHex))
    .send({ from: connectedAddress });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? "confirm_closing did not execute successfully.");
  }
  return receipt.txHash.toString();
}

export interface LoadedOnChainListings {
  listings: Listing[];
  skipped: string[];
}

function readAddressText(value: unknown): string | null {
  const text = typeof value === "string" ? value : value ? String(value) : "";
  return /^0x[0-9a-fA-F]{64}$/.test(text) ? text : null;
}

export async function loadOnChainListings(connection: ConnectedAztecWallet): Promise<LoadedOnChainListings> {
  await assertSealedAuctionFunction("get_listing");
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  await registerAuctionWithWallet(connection, artifact, auctionAddress);
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const methods = auction.methods as unknown as SealedAuctionMethods;
  const listings: Listing[] = [];
  const skipped: string[] = [];
  for (const metadata of ON_CHAIN_LISTING_METADATA) {
    try {
      const { result } = await methods.get_listing(Fr.fromString(metadata.id)).simulate({ from: connectedAddress });
      const info = result as {
        seller?: unknown;
        reserve_price?: unknown;
        verified?: unknown;
        category?: unknown;
        stake_bps?: unknown;
        legal_closing_window?: unknown;
      } | null | undefined;
      const sellerText = info ? readAddressText(info.seller) : null;
      if (
        !info ||
        !sellerText ||
        info.verified !== true ||
        typeof info.reserve_price !== "bigint" ||
        typeof info.category !== "bigint" ||
        typeof info.stake_bps !== "bigint" ||
        typeof info.legal_closing_window !== "bigint"
      ) {
        throw new Error("get_listing returned an unexpected value.");
      }
      listings.push({
        id: metadata.id,
        title: metadata.title,
        category: info.category === BigInt(1) ? "real-estate" : "mobile-goods",
        region: metadata.region,
        description: metadata.description,
        reservePrice: Number(info.reserve_price),
        stakeBps: Number(info.stake_bps),
        legalClosingWindowSeconds: Number(info.legal_closing_window),
        currency: "TEST",
        verifiedBy: "Configured on-chain asset verifier",
        sellerWalletAddress: sellerText,
        onChain: true,
      });
    } catch (error) {
      skipped.push(metadata.title + ": " + (error instanceof Error ? error.message : "read failed"));
    }
  }
  return { listings, skipped };
}

async function sendPublicListingCall(
  connection: ConnectedAztecWallet,
  functionName: "close_auction" | "finalize_settlement",
  listingIdHex: string,
): Promise<string> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(listingIdHex)) {
    throw new Error("Listing id must be 0x followed by 64 hex characters.");
  }
  await assertSealedAuctionFunction(functionName);
  const config = getNetworkConfig();
  const auctionAddress = configuredAddress(config.contractAddress, "Auction contract");
  const connectedAddress = configuredAddress(connection.address, "Connected account");
  const artifact = await getSealedAuctionArtifact();
  await registerAuctionWithWallet(connection, artifact, auctionAddress);
  const auction = Contract.at(auctionAddress, artifact, connection.wallet);
  const methods = auction.methods as unknown as SealedAuctionMethods;
  const { receipt } = await methods[functionName](Fr.fromString(listingIdHex)).send({ from: connectedAddress });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? functionName + " did not execute successfully.");
  }
  return receipt.txHash.toString();
}

export function closeAuctionOnChain(connection: ConnectedAztecWallet, listingIdHex: string): Promise<string> {
  return sendPublicListingCall(connection, "close_auction", listingIdHex);
}

export function finalizeSettlementOnChain(connection: ConnectedAztecWallet, listingIdHex: string): Promise<string> {
  return sendPublicListingCall(connection, "finalize_settlement", listingIdHex);
}
