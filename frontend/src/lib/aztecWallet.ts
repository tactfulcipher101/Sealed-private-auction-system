import { createAztecNodeClient } from "@aztec/aztec.js/node";
import type { Wallet } from "@aztec/aztec.js/wallet";
import { Fr } from "@aztec/foundation/curves/bn254";
import type { WalletProvider } from "@aztec/wallet-sdk/manager";
import { getNetworkConfig } from "@/lib/network";

export interface ConnectedAztecWallet {
  address: string;
  provider: WalletProvider;
  wallet: Wallet;
  disconnect: () => Promise<void>;
}

export async function getConfiguredChainInfo() {
  const nodeInfo = await getConfiguredNodeInfo();

  return {
    chainId: new Fr(nodeInfo.l1ChainId),
    version: new Fr(nodeInfo.rollupVersion),
  };
}

export async function getConfiguredNodeInfo() {
  const config = getNetworkConfig();
  if (!config.nodeUrl) {
    throw new Error(`Set NEXT_PUBLIC_AZTEC_${config.mode.toUpperCase()}_NODE_URL to connect a wallet.`);
  }

  const node = createAztecNodeClient(config.nodeUrl);
  return await node.getNodeInfo();
}
