import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="w-full border-b border-slate-800/80 bg-[#090D14]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="truncate font-bold text-slate-100 tracking-tight text-base sm:text-lg">
            SEALED <span className="hidden sm:inline text-xs font-mono font-normal text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded ml-1">Protocol Spec</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
          <a href="/about" className="hover:text-slate-100 transition-colors">About</a>
          <a href="/protocol" className="hover:text-slate-100 transition-colors">Blueprint</a>
          <a href="/demo" className="hover:text-slate-100 transition-colors">Live Demo</a>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <a href="/demo" className="px-3 sm:px-4 py-2 text-xs font-medium bg-slate-100 text-slate-950 rounded-md hover:bg-white transition-all">Launch Demo</a>
        </div>
      </div>
    </header>
  );
}

