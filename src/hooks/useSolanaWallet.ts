import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";

export interface SolanaWalletState {
  publicKey: PublicKey | null;
  address: string | null;
  isConnected: boolean;
  isPhantomInstalled: boolean;
}

export function useSolanaWallet() {
  const [wallet, setWallet] = useState<SolanaWalletState>(() => {
    const sol = (window as any).solana;
    const pk: PublicKey | null = sol?.publicKey ?? null;
    return {
      publicKey: pk,
      address: pk?.toBase58() ?? null,
      isConnected: sol?.isConnected ?? false,
      isPhantomInstalled: Boolean(sol?.isPhantom),
    };
  });

  const refresh = useCallback(() => {
    const sol = (window as any).solana;
    const pk: PublicKey | null = sol?.publicKey ?? null;
    setWallet({
      publicKey: pk,
      address: pk?.toBase58() ?? null,
      isConnected: Boolean(sol?.isConnected && pk),
      isPhantomInstalled: Boolean(sol?.isPhantom),
    });
  }, []);

  const connect = useCallback(async () => {
    const sol = (window as any).solana;
    if (!sol?.isPhantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    await sol.connect();
    refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    const sol = (window as any).solana;
    await sol?.disconnect();
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sol = (window as any).solana;
    if (!sol) return;
    sol.on("connect", refresh);
    sol.on("disconnect", refresh);
    sol.on("accountChanged", refresh);
    return () => {
      sol.off?.("connect", refresh);
      sol.off?.("disconnect", refresh);
      sol.off?.("accountChanged", refresh);
    };
  }, [refresh]);

  return { wallet, connect, disconnect };
}

export function shortenSolAddress(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}
