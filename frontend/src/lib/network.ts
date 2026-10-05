export type NetworkMode = "testnet" | "mainnet";
export type SupportedCurrency = "TEST" | "USDC" | "USDT" | "cNGN" | "EURC";

export interface DeploymentConfig {
  mode: NetworkMode;
  label: string;
  nodeUrl: string | null;
  explorerUrl: string | null;
  sponsoredFpcAddress: string | null;
  contractAddress: string | null;
  assetVerifierAddress: string | null;
  treasuryAddress: string | null;
  pauseGuardians: string[];
  pauseThreshold: number;
  tokenAddresses: Partial<Record<SupportedCurrency, string>>;
  isConfigured: boolean;
}

function envValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createConfig(
  mode: NetworkMode,
  values: {
    nodeUrl?: string;
    explorerUrl?: string;
    sponsoredFpcAddress?: string;
    contractAddress?: string;
    assetVerifierAddress?: string;
    treasuryAddress?: string;
    pauseGuardians?: string;
    pauseThreshold?: string;
    tokenAddresses?: Partial<Record<SupportedCurrency, string | undefined>>;
  },
): DeploymentConfig {
  const pauseGuardians = (values.pauseGuardians ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  const pauseThreshold = Number(values.pauseThreshold ?? 2);
  const tokenAddresses = Object.fromEntries(
    Object.entries(values.tokenAddresses ?? {})
      .map(([currency, address]) => [currency, envValue(address)])
      .filter((entry): entry is [string, string] => entry[1] !== null),
  ) as Partial<Record<SupportedCurrency, string>>;

  return {
    mode,
    label: mode === "testnet" ? "Aztec Testnet" : "Aztec Mainnet",
    nodeUrl: envValue(values.nodeUrl) ?? (mode === "testnet" ? "https://v5.testnet.rpc.aztec-labs.com" : null),
    explorerUrl: envValue(values.explorerUrl) ?? (mode === "testnet" ? "https://testnet.aztecscan.xyz" : null),
    sponsoredFpcAddress: envValue(values.sponsoredFpcAddress) ?? (mode === "testnet" ? "0x130925fbd734a252e3d8ddff87f6c346052dd2" : null),
    contractAddress: envValue(values.contractAddress),
    assetVerifierAddress: envValue(values.assetVerifierAddress),
    treasuryAddress: envValue(values.treasuryAddress),
    pauseGuardians,
    pauseThreshold: Number.isInteger(pauseThreshold) && pauseThreshold > 0 ? pauseThreshold : 2,
    tokenAddresses,
    isConfigured: Boolean(
      (envValue(values.nodeUrl) || mode === "testnet") &&
      envValue(values.contractAddress) &&
      envValue(values.assetVerifierAddress) &&
      envValue(values.treasuryAddress) &&
      pauseGuardians.length === 3 &&
      Number.isInteger(pauseThreshold) &&
      pauseThreshold > 0 &&
      pauseThreshold <= pauseGuardians.length &&
      Object.keys(tokenAddresses).length > 0
    ),
  };
}

export const deploymentConfigs: Record<NetworkMode, DeploymentConfig> = {
  testnet: createConfig("testnet", {
    nodeUrl: process.env.NEXT_PUBLIC_AZTEC_TESTNET_NODE_URL,
    explorerUrl: process.env.NEXT_PUBLIC_AZTEC_TESTNET_EXPLORER_URL,
    sponsoredFpcAddress: process.env.NEXT_PUBLIC_AZTEC_TESTNET_SPONSORED_FPC_ADDRESS,
    contractAddress: process.env.NEXT_PUBLIC_AZTEC_TESTNET_CONTRACT_ADDRESS,
    assetVerifierAddress: process.env.NEXT_PUBLIC_AZTEC_TESTNET_ASSET_VERIFIER_ADDRESS,
    treasuryAddress: process.env.NEXT_PUBLIC_AZTEC_TESTNET_TREASURY_ADDRESS,
    pauseGuardians: process.env.NEXT_PUBLIC_AZTEC_TESTNET_PAUSE_GUARDIANS,
    pauseThreshold: process.env.NEXT_PUBLIC_AZTEC_TESTNET_PAUSE_THRESHOLD,
    tokenAddresses: {
      TEST: process.env.NEXT_PUBLIC_AZTEC_TESTNET_TEST_TOKEN_ADDRESS,
      USDC: process.env.NEXT_PUBLIC_AZTEC_TESTNET_USDC_TOKEN_ADDRESS,
      USDT: process.env.NEXT_PUBLIC_AZTEC_TESTNET_USDT_TOKEN_ADDRESS,
      cNGN: process.env.NEXT_PUBLIC_AZTEC_TESTNET_CNGN_TOKEN_ADDRESS,
      EURC: process.env.NEXT_PUBLIC_AZTEC_TESTNET_EURC_TOKEN_ADDRESS,
    },
  }),
  mainnet: createConfig("mainnet", {
    nodeUrl: process.env.NEXT_PUBLIC_AZTEC_MAINNET_NODE_URL,
    explorerUrl: process.env.NEXT_PUBLIC_AZTEC_MAINNET_EXPLORER_URL,
    sponsoredFpcAddress: process.env.NEXT_PUBLIC_AZTEC_MAINNET_SPONSORED_FPC_ADDRESS,
    contractAddress: process.env.NEXT_PUBLIC_AZTEC_MAINNET_CONTRACT_ADDRESS,
    assetVerifierAddress: process.env.NEXT_PUBLIC_AZTEC_MAINNET_ASSET_VERIFIER_ADDRESS,
    treasuryAddress: process.env.NEXT_PUBLIC_AZTEC_MAINNET_TREASURY_ADDRESS,
    pauseGuardians: process.env.NEXT_PUBLIC_AZTEC_MAINNET_PAUSE_GUARDIANS,
    pauseThreshold: process.env.NEXT_PUBLIC_AZTEC_MAINNET_PAUSE_THRESHOLD,
    tokenAddresses: {
      TEST: process.env.NEXT_PUBLIC_AZTEC_MAINNET_TEST_TOKEN_ADDRESS,
      USDC: process.env.NEXT_PUBLIC_AZTEC_MAINNET_USDC_TOKEN_ADDRESS,
      USDT: process.env.NEXT_PUBLIC_AZTEC_MAINNET_USDT_TOKEN_ADDRESS,
      cNGN: process.env.NEXT_PUBLIC_AZTEC_MAINNET_CNGN_TOKEN_ADDRESS,
      EURC: process.env.NEXT_PUBLIC_AZTEC_MAINNET_EURC_TOKEN_ADDRESS,
    },
  }),
};

const requestedMode = process.env.NEXT_PUBLIC_AZTEC_NETWORK;
export const defaultNetworkMode: NetworkMode = requestedMode === "mainnet" ? "mainnet" : "testnet";

export function getNetworkConfig(mode: NetworkMode = defaultNetworkMode) {
  return deploymentConfigs[mode];
}
