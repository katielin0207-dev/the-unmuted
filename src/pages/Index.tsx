import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useSilentMode } from "@/hooks/useSilentMode";
import WalletConnect from "@/components/WalletConnect";
import TopBarToggles from "@/components/TopBarToggles";
import SOSButton from "@/components/SOSButton";
import OfflineBanner from "@/components/OfflineBanner";
import BottomNav from "@/components/BottomNav";
import MapPage from "@/components/MapPage";
import EvidencePage from "@/components/EvidencePage";
import DeterrentAudioPanel from "@/components/DeterrentAudioPanel";
import { Shield } from "lucide-react";

const CONTRACT_ADDRESS = "0x79B1A83d803213560BA5AF373FDcE54d1e84f18c";

export default function Index() {
  const [activeTab, setActiveTab] = useState<"sos" | "map" | "evidence">("sos");
  const walletHook = useWallet(CONTRACT_ADDRESS);
  const { soundOn, toggleSound, isSilent, voiceDeterrent, customAudioUrl, saveCustomAudio } = useSilentMode();

  const { wallet } = walletHook;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Top bar — sits below the iOS status bar (safe-area-inset-top handled by body) */}
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-foreground">The Unmuted</span>
        </div>
        <div className="flex items-center gap-3">
          <TopBarToggles soundOn={soundOn} onToggleSound={toggleSound} />
          <WalletConnect contractAddress={CONTRACT_ADDRESS} walletHook={walletHook} />
        </div>
      </header>

      {/* Offline banner */}
      <OfflineBanner
        contract={wallet.contract}
        isWalletConnected={wallet.isConnected}
        isCorrectNetwork={wallet.isCorrectNetwork}
        isSilent={isSilent}
      />

      {/* Main content — pb-20 leaves room for bottom nav + safe-area */}
      <main className="flex flex-1 flex-col overflow-y-auto pb-20">
        {activeTab === "sos" && (
          <>
            <SOSButton
              contract={wallet.contract}
              isWalletConnected={wallet.isConnected}
              isCorrectNetwork={wallet.isCorrectNetwork}
              isSilent={isSilent}
              voiceDeterrent={voiceDeterrent}
              customAudioUrl={customAudioUrl}
            />
            <DeterrentAudioPanel
              customAudioUrl={customAudioUrl}
              onSaveAudio={saveCustomAudio}
            />
          </>
        )}
        {activeTab === "map" && <MapPage contract={wallet.contract} />}
        {activeTab === "evidence" && <EvidencePage />}
      </main>

      {/* Bottom nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
