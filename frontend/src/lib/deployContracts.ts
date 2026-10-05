import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import { getConfiguredChainInfo, getConfiguredNodeInfo, type ConnectedAztecWallet } from "@/lib/aztecWallet";

export interface DeploymentResult {
  address: string;
  transactionHash: string;
}

export interface DeploymentReadiness {
  nodeVersion: string;
  artifactVersion: string;
  isCompatible: boolean;
  detail: string;
}

async function loadArtifact(filename: string): Promise<ContractArtifact & { aztec_version: string }> {
  const response = await fetch(`/artifacts/${filename}`);
  if (!response.ok) {
    throw new Error(`Compiled artifact ${filename} is unavailable. Run aztec compile --workspace and restart the frontend.`);
  }
  return await response.json() as ContractArtifact & { aztec_version: string };
}

export async function getDeploymentReadiness(connection: ConnectedAztecWallet): Promise<DeploymentReadiness> {
  const [nodeInfo, auctionArtifact, tokenArtifact, connectedChain, configuredChain] = await Promise.all([
    getConfiguredNodeInfo(),
    loadArtifact("sealed_auction-SealedAuction.json"),
    loadArtifact("private_token-PrivateToken.json"),
    connection.wallet.getChainInfo(),
    getConfiguredChainInfo(),
  ]);

  if (!connectedChain.chainId.equals(configuredChain.chainId) || !connectedChain.version.equals(configuredChain.version)) {
    return {
      nodeVersion: nodeInfo.nodeVersion,
      artifactVersion: auctionArtifact.aztec_version,
      isCompatible: false,
      detail: "Connected wallet and configured node report different chain identities.",
    };
  }

  const compatible = auctionArtifact.aztec_version === nodeInfo.nodeVersion &&
    tokenArtifact.aztec_version === nodeInfo.nodeVersion;
  return {
    nodeVersion: nodeInfo.nodeVersion,
    artifactVersion: auctionArtifact.aztec_version,
    isCompatible: compatible,
    detail: compatible
      ? "Both contract artifacts match the configured network node version."
      : "Contract artifacts and node versions do not match. Deploying is blocked until the Noir/Aztec toolchain is aligned with this network.",
  };
}

async function validateDeployment(connection: ConnectedAztecWallet) {
  const readiness = await getDeploymentReadiness(connection);
  if (!readiness.isCompatible) throw new Error(readiness.detail);
  return readiness;
}

export async function deployPrivateToken(connection: ConnectedAztecWallet): Promise<DeploymentResult> {
  await validateDeployment(connection);
  const artifact = await loadArtifact("private_token-PrivateToken.json");
  const account = AztecAddress.schema.parse(connection.address);
  const { contract, receipt } = await Contract.deploy(connection.wallet, artifact, []).send({ from: account });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? "PrivateToken deployment failed.");
  }
  return { address: contract.address.toString(), transactionHash: receipt.txHash.toString() };
}

export async function deploySealedAuction(
  connection: ConnectedAztecWallet,
  treasuryInput: string,
  guardianInputs: [string, string, string],
  pauseThreshold: number,
): Promise<DeploymentResult> {
  await validateDeployment(connection);
  const artifact = await loadArtifact("sealed_auction-SealedAuction.json");
  const account = AztecAddress.schema.parse(connection.address);
  const treasury = AztecAddress.schema.parse(treasuryInput.trim());
  const guardians = guardianInputs.map((address) => AztecAddress.schema.parse(address.trim())) as [AztecAddress, AztecAddress, AztecAddress];
  if (treasury.isZero() || guardians.some((guardian) => guardian.isZero())) {
    throw new Error("Treasury and guardian addresses must be nonzero Aztec addresses.");
  }
  if (new Set(guardians.map((guardian) => guardian.toString())).size !== 3) {
    throw new Error("All three pause guardians must be different accounts.");
  }
  if (!Number.isInteger(pauseThreshold) || pauseThreshold < 1 || pauseThreshold > 3) {
    throw new Error("Pause threshold must be from one to three.");
  }

  const { contract, receipt } = await Contract.deploy(
    connection.wallet,
    artifact,
    [treasury, guardians, pauseThreshold],
  ).send({ from: account });
  if (!receipt.hasExecutionSucceeded()) {
    throw new Error(receipt.error ?? "SealedAuction deployment failed.");
  }
  return { address: contract.address.toString(), transactionHash: receipt.txHash.toString() };
}
