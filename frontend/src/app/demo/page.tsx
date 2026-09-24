import { Header } from "@/ui/layout/Header";
import { Footer } from "@/ui/layout/Footer";
import { AuctionDemo } from "@/ui/modules/demo/AuctionDemo";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#090D14] text-slate-100 font-sans antialiased selection:bg-slate-800 selection:text-slate-200">
      <Header />
      <main>
        <AuctionDemo />
      </main>
      <Footer />
    </div>
  );
}
