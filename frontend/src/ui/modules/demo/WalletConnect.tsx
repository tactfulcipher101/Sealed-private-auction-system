"use client";

import { useState } from "react";
import { Wallet, Loader2, ShieldCheck } from "lucide-react";
import { generateWalletAddress } from "@/lib/demoCrypto";

interface WalletConnectProps {
  onConnected: (walletAddress: string) => void;
}

export function WalletConnect({ onConnected }: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  function handleConnect() {
    setIsConnecting(true);
    setTimeout(() => {
      onConnected(generateWalletAddress());
    }, 900);
  }

  return (
    <div className="max-w-sm mx-auto text-center space-y-6 py-12">
      <div className="h-14 w-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
        <Wallet className="h-6 w-6 text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-100">Connect a wallet to continue</h2>
        <p className="text-sm text-slate-400">
          No name, email, or phone number required. Your wallet address is your account.
        </p>
      </div>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" /> Connect wallet
          </>
        )}
      </button>
    </div>
  );
}
