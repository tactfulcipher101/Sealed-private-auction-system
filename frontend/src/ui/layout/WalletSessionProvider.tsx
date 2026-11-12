"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ConnectedAztecWallet } from "@/lib/aztecWallet";

interface WalletSessionValue {
  connection: ConnectedAztecWallet | null;
  setConnection: (next: ConnectedAztecWallet | null) => void;
}

const WalletSessionContext = createContext<WalletSessionValue | null>(null);

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ConnectedAztecWallet | null>(null);
  return (
    <WalletSessionContext.Provider value={{ connection, setConnection }}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession(): WalletSessionValue {
  const session = useContext(WalletSessionContext);
  if (!session) throw new Error("useWalletSession must be used inside WalletSessionProvider.");
  return session;
}
