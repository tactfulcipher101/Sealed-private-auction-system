"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, ShieldCheck, Wallet, X } from "lucide-react";
import { WalletManager, type DiscoverySession, type PendingConnection, type WalletProvider } from "@aztec/wallet-sdk/manager";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";
import { getConfiguredChainInfo } from "@/lib/aztecWallet";
import { hashToEmoji } from "@aztec/wallet-sdk/crypto";

interface WalletConnectProps {
  onConnected: (connection: ConnectedAztecWallet) => void;
}

export function WalletConnect({ onConnected }: WalletConnectProps) {
  const discoveryRef = useRef<DiscoverySession | null>(null);
  const pendingRef = useRef<PendingConnection | null>(null);
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider | null>(null);
  const [verificationHash, setVerificationHash] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    discoveryRef.current?.cancel();
    pendingRef.current?.cancel();
  }, []);

  async function discoverWallets() {
    setError(null);
    setProviders([]);
    setSelectedProvider(null);
    setVerificationHash(null);
    setIsConnecting(true);

    try {
      const chainInfo = await getConfiguredChainInfo();
      const manager = WalletManager.configure({ extensions: { enabled: true } });
      const discovery = manager.getAvailableWallets({
        chainInfo,
        appId: "sealed-private-auction",
        timeout: 60_000,
        onWalletDiscovered(provider) {
          setProviders((current) => current.some((item) => item.id === provider.id)
            ? current
            : [...current, provider]);
        },
      });
      discoveryRef.current = discovery;
      void discovery.done.finally(() => {
        if (discoveryRef.current === discovery) discoveryRef.current = null;
        setIsConnecting(false);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to discover Aztec wallets.");
      setIsConnecting(false);
    }
  }

  async function startSecureConnection(provider: WalletProvider) {
    setError(null);
    setIsConnecting(true);
    setSelectedProvider(provider);
    try {
      const pending = await provider.establishSecureChannel("sealed-private-auction");
      pendingRef.current = pending;
      setVerificationHash(pending.verificationHash);
      discoveryRef.current?.cancel();
      discoveryRef.current = null;
      setIsConnecting(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Secure wallet connection failed.");
      setSelectedProvider(null);
      setIsConnecting(false);
    }
  }

  async function confirmSecureConnection() {
    const provider = selectedProvider;
    const pending = pendingRef.current;
    if (!provider || !pending) return;

    setError(null);
    setIsConnecting(true);
    try {
      const wallet = await pending.confirm();
      pendingRef.current = null;
      const accounts = await wallet.getAccounts();
      if (accounts.length === 0) throw new Error("The connected wallet did not grant an account.");

      const unsubscribe = provider.onDisconnect(() => {
        void provider.disconnect();
        unsubscribe();
      });
      onConnected({
        address: accounts[0].item.toString(),
        provider,
        wallet,
        disconnect: async () => {
          unsubscribe();
          await provider.disconnect();
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection was not confirmed.");
      pending.cancel();
      pendingRef.current = null;
      setSelectedProvider(null);
      setVerificationHash(null);
      setIsConnecting(false);
    }
  }

  function cancelSecureConnection() {
    pendingRef.current?.cancel();
    pendingRef.current = null;
    setSelectedProvider(null);
    setVerificationHash(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
          <Wallet className="h-6 w-6 text-emerald-400" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-slate-100">Connect an Aztec wallet</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Wallet discovery checks compatibility with the configured node. Verify the security phrase in your wallet before approving the session.
        </p>
      </div>

      {!verificationHash && providers.length === 0 && (
        <button
          type="button"
          onClick={discoverWallets}
          disabled={isConnecting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 py-3 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-50"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {isConnecting ? "Searching for wallets..." : "Find Aztec wallets"}
        </button>
      )}

      {providers.length > 0 && !verificationHash && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Available wallets</p>
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => void startSecureConnection(provider)}
              disabled={isConnecting}
              className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-slate-600 disabled:opacity-50"
            >
              <span>{provider.name}</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </button>
          ))}
          {isConnecting && <p className="text-center text-xs text-slate-500">Waiting for wallet approval...</p>}
        </div>
      )}

      {verificationHash && selectedProvider && (
        <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-slate-100">Verify the connection phrase</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Compare these emojis, in this order, with {selectedProvider.name}. Approve only if both match.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded border border-slate-800 bg-slate-950 p-3 text-center text-3xl">
            {Array.from(hashToEmoji(verificationHash)).map((emojiSymbol, emojiPosition) => (
              <span key={emojiPosition}>{emojiSymbol}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelSecureConnection}
              disabled={isConnecting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmSecureConnection()}
              disabled={isConnecting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Phrase matches
            </button>
          </div>
        </div>
      )}

      {isConnecting && providers.length > 0 && verificationHash && (
        <p className="text-center text-xs text-slate-500">Confirming wallet account...</p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs leading-5 text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {isConnecting && providers.length === 0 && (
        <p className="text-center text-xs text-slate-500">Approve the discovery request in your Aztec wallet extension.</p>
      )}
    </div>
  );
}
