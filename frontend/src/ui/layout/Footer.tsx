import { Lock, Scale } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-12 px-6 bg-[#070A0F]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800/60 pb-8">
        
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Lock className="h-3 w-3 text-slate-300" />
          </div>
          <span className="font-semibold text-slate-200 text-sm tracking-tight">
            SEALED PROTOCOL
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <a href="#architecture" className="hover:text-slate-200 transition-colors">Privacy Blueprint</a>
          <a href="#settlement" className="hover:text-slate-200 transition-colors">Reveal-at-Close Mechanics</a>
          <a href="#physical-verification" className="hover:text-slate-200 transition-colors">Partner Framework</a>
          <a href="#" className="hover:text-slate-200 transition-colors">Jurisdiction Compliance</a>
        </div>

      </div>

      <div className="max-w-7xl mx-auto pt-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
        <p>(c) 2026 Sealed Protocol. Unhosted cryptographic software protocol.</p>
        <div className="flex items-center gap-2">
          <Scale className="h-3 w-3 text-slate-500" />
          <span>Subject to Jurisdiction-Specific Legal Review</span>
        </div>
      </div>
    </footer>
  );
}
