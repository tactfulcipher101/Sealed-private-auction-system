"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clipboard, Loader2, Rocket, ShieldCheck, Wallet } from "lucide-react";
import { getDeploymentReadiness, deployPrivateToken, deploySealedAuction, type DeploymentReadiness, type DeploymentResult } from "@/lib/deployContracts";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { defaultNetworkMode, getNetworkConfig } from "@/lib/network";
import { WalletConnect } from "@/ui/modules/demo/WalletConnect";

export function TestnetDeploymentWizard() {
  const [connection, setConnection] = useState<ConnectedAztecWallet | null>(null);
  const [readinessState, setReadinessState] = useState<{
    address: string;
    readiness?: DeploymentReadiness;
    error?: string;
  } | null>(null);
  const [tokenDeployment, setTokenDeployment] = useState<DeploymentResult | null>(null);
  const [auctionDeployment, setAuctionDeployment] = useState<DeploymentResult | null>(null);
  const [treasury, setTreasury] = useState("");
  const [guardians, setGuardians] = useState<[string, string, string]>(["", "", ""]);
  const [pauseThreshold, setPauseThreshold] = useState("2");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const config = getNetworkConfig();

  useEffect(() => {
    let active = true;
    if (!connection) return;
    void getDeploymentReadiness(connection).then((result) => {
      if (active) setReadinessState({ address: connection.address, readiness: result });
    }).catch((cause: unknown) => {
      if (active) setReadinessState({
        address: connection.address,
        error: cause instanceof Error ? cause.message : "Could not check deployment readiness.",
      });
    });
    return () => { active = false; };
  }, [connection]);

  const readiness = readinessState?.address === connection?.address ? readinessState?.readiness : undefined;
  const readinessError = readinessState?.address === connection?.address ? readinessState?.error : undefined;

  async function handleDeployToken() {
    if (!connection) return;
    setError(null);
    setIsWorking(true);
    try {
      setTokenDeployment(await deployPrivateToken(connection));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test token deployment failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDeployAuction() {
    if (!connection) return;
    setError(null);
    setIsWorking(true);
    try {
      setAuctionDeployment(await deploySealedAuction(
        connection,
        treasury,
        guardians,
        Number(pauseThreshold),
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Auction deployment failed.");
    } finally {
      setIsWorking(false);
    }
  }

  const envSnippet = tokenDeployment && auctionDeployment && connection
    ? [
        "NEXT_PUBLIC_AZTEC_NETWORK=testnet",
        `NEXT_PUBLIC_AZTEC_TESTNET_NODE_URL=${config.nodeUrl ?? ""}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_EXPLORER_URL=${config.explorerUrl ?? ""}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_CONTRACT_ADDRESS=${auctionDeployment.address}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_ASSET_VERIFIER_ADDRESS=${connection.address}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_TREASURY_ADDRESS=${treasury.trim()}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_PAUSE_GUARDIANS=${guardians.map((address) => address.trim()).join(",")}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_PAUSE_THRESHOLD=${pauseThreshold}`,
        `NEXT_PUBLIC_AZTEC_TESTNET_TEST_TOKEN_ADDRESS=${tokenDeployment.address}`,
      ].join("\n")
    : null;

  async function copyEnvironment() {
    if (!envSnippet) return;
    await navigator.clipboard.writeText(envSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (defaultNetworkMode !== "testnet") {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-amber-200">Deployment wizard is testnet-only. Set NEXT_PUBLIC_AZTEC_NETWORK=testnet and restart the frontend.</div>;
  }

  if (!connection) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Testnet setup</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Deploy the auction contracts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            This deploys the test-only private token and the auction using your wallet. Your account becomes the initial asset verifier. Never use the faucet token for production.
          </p>
        </div>
        <WalletConnect onConnected={setConnection} />
      </div>
    );
  }

  const deployEnabled = readiness?.isCompatible === true && !isWorking;

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Testnet setup</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Deploy Sealed</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <Wallet className="h-4 w-4 text-emerald-400" /> {connection.address}
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-start gap-3">
          {readiness?.isCompatible ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">Network and artifact compatibility</h2>
            {readiness ? (
              <>
                <p className="mt-2 text-xs leading-5 text-slate-400">Node reports {readiness.nodeVersion}; artifacts are {readiness.artifactVersion}.</p>
                <p className={"mt-2 text-xs leading-5 " + (readiness.isCompatible ? "text-emerald-200" : "text-amber-200")}>{readiness.detail}</p>
              </>
            ) : readinessError ? (
              <p className="mt-2 text-xs leading-5 text-rose-200">{readinessError}</p>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking configured node...</p>
            )}
          </div>
        </div>
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">
          This wizard does not attach a sponsored-fee method. The connected account must have testnet Fee Juice before deploying. Faucet: <a className="underline" href="https://aztec-faucet.nethermind.io/" target="_blank" rel="noreferrer">aztec-faucet.nethermind.io</a>. The test token is a faucet fixture and is not USDC.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">1. Deploy test token</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Deploys the repo’s `PrivateToken` fixture with its public faucet. Use it only under the TEST symbol; it is not a production asset.</p>
        </div>
        {tokenDeployment ? (
          <div className="space-y-1 text-xs text-emerald-200"><p>Token address: <code className="break-all">{tokenDeployment.address}</code></p><p>Deployment tx: <code className="break-all">{tokenDeployment.transactionHash}</code></p></div>
        ) : (
          <button type="button" onClick={() => void handleDeployToken()} disabled={!deployEnabled} className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Deploy test token
          </button>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">2. Deploy auction</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Your connected account will be the initial asset verifier. The treasury and guardians become constructor parameters.</p>
        </div>
        <label className="block text-xs text-slate-400">Treasury Aztec address
          <input value={treasury} onChange={(event) => setTreasury(event.target.value)} placeholder="0x..." className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {guardians.map((guardian, index) => (
            <label key={index} className="block text-xs text-slate-400">Pause guardian {index + 1}
              <input value={guardian} onChange={(event) => setGuardians((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value) as [string, string, string])} placeholder="0x..." className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white" />
            </label>
          ))}
        </div>
        <label className="block max-w-xs text-xs text-slate-400">Guardian threshold
          <select value={pauseThreshold} onChange={(event) => setPauseThreshold(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white">
            <option value="1">1 of 3</option><option value="2">2 of 3</option><option value="3">3 of 3</option>
          </select>
        </label>
        {auctionDeployment ? (
          <div className="space-y-1 text-xs text-emerald-200"><p>Auction address: <code className="break-all">{auctionDeployment.address}</code></p><p>Deployment tx: <code className="break-all">{auctionDeployment.transactionHash}</code></p></div>
        ) : (
          <button type="button" onClick={() => void handleDeployAuction()} disabled={!deployEnabled || !tokenDeployment || !treasury.trim() || guardians.some((address) => !address.trim())} className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Deploy auction contract
          </button>
        )}
      </section>

      {auctionDeployment?.auctionSecret && (
        <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div>
            <h2 className="text-sm font-semibold text-amber-100">Save the auction secret now</h2>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">This secret is shown once and is not stored anywhere. Escrowed bids are held under keys derived from it, and every account that claims a payout or refund needs it registered in its wallet. If it is lost, escrowed funds cannot be paid out.</p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-[11px] leading-5 text-slate-200">{auctionDeployment.auctionSecret}</pre>
          <button type="button" onClick={() => void navigator.clipboard.writeText(auctionDeployment.auctionSecret ?? "")} className="flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/10"><Clipboard className="h-3.5 w-3.5" />Copy secret</button>
        </section>
      )}

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      {envSnippet && (
        <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <div><h2 className="text-sm font-semibold text-emerald-100">Deployment parameters captured</h2><p className="mt-1 text-xs text-emerald-100/70">Copy these public addresses into frontend/.env.local. The token is the test-only fixture.</p></div>
          <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-[11px] leading-5 text-slate-200">{envSnippet}</pre>
          <button type="button" onClick={() => void copyEnvironment()} className="flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/10"><Clipboard className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy config"}</button>
        </section>
      )}
    </div>
  );
}
