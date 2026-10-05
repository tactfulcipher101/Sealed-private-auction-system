import { Header } from "@/ui/layout/Header";
import { Footer } from "@/ui/layout/Footer";
import { TestnetDeploymentWizard } from "@/ui/modules/demo/TestnetDeploymentWizard";

export default function DeployPage() {
  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 font-sans antialiased selection:bg-slate-800 selection:text-slate-200">
      <Header />
      <main>
        <TestnetDeploymentWizard />
      </main>
      <Footer />
    </div>
  );
}
