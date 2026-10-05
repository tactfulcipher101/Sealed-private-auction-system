import { Header } from "@/ui/layout/Header";
import { Footer } from "@/ui/layout/Footer";
import { Hero } from "@/ui/modules/landing/Hero";
import { ArchitectureSpec } from "@/ui/modules/landing/ArchitectureSpec";
import { LogisticsFramework } from "@/ui/modules/landing/LogisticsFramework";
import { ProofSimulator } from "@/ui/modules/landing/ProofSimulator";
import { LaunchConfig } from "@/ui/modules/landing/LaunchConfig";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 font-sans antialiased selection:bg-slate-800 selection:text-slate-200">
      <Header />
      
      <main>
        <Hero />
        <ArchitectureSpec />
        <LogisticsFramework />
        <LaunchConfig />
        <ProofSimulator />
      </main>

      <Footer />
    </div>
  );
}