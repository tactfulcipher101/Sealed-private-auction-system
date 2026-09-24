"use client";

import React, { useState } from "react";
import { Cpu, Key } from "lucide-react";
import { motion } from "framer-motion";

export function ProofSimulator() {
  const [bidValue, setBidValue] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USDC");
  const [isGeneratingProof, setIsGeneratingProof] = useState<boolean>(false);
  const [proofGenerated, setProofGenerated] = useState<boolean>(false);

  const handleSimulateProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidValue) return;
    setIsGeneratingProof(true);
    setProofGenerated(false);
    setTimeout(() => {
      setIsGeneratingProof(false);
      setProofGenerated(true);
    }, 1800);
  };

  return (
    <section id="simulator" className="py-20 px-6 border-b border-slate-800/50">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="text-center space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Interactive Blueprint Demo</h2>
          <h3 className="text-2xl font-bold text-slate-100">Simulate Solvency Proof Generation</h3>
          <p className="text-slate-400 text-sm">
            Test how a bidder generates a zero-knowledge solvency proof on-device before submitting a hashed bid commitment.
          </p>
        </div>

        <div className="p-8 rounded-lg bg-slate-900/80 border border-slate-800 space-y-6">
          <form onSubmit={handleSimulateProof} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Private Bid Commitment Amount
                </label>
                <input
                  type="number"
                  value={bidValue}
                  onChange={(e) => setBidValue(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Asset Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-sm text-slate-100 focus:outline-none focus:border-slate-500 transition-colors"
                >
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="cNGN">cNGN</option>
                  <option value="EURC">EURC</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGeneratingProof || !bidValue}
              className="w-full py-3 bg-slate-100 text-slate-950 text-sm font-medium rounded-lg hover:bg-white disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGeneratingProof ? (
                <>
                  <Cpu className="h-4 w-4 animate-spin text-slate-900" />
                  Executing Local ZK Solvency Check...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 text-slate-900" />
                  Generate Solvency Proof & Commit Bid
                </>
              )}
            </button>
          </form>

          {proofGenerated && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-xs space-y-2 text-slate-400"
            >
              <div className="flex items-center justify-between text-emerald-400 text-[11px] font-semibold border-b border-slate-900 pb-2">
                <span>STATUS: SOLVENCY_PROOF_VALID</span>
                <span>LATENCY: 1.1s</span>
              </div>
              <p><span className="text-slate-600">Commitment_Hash:</span> 0x3d9c...77a11e2</p>
              <p><span className="text-slate-600">Solvency_Check:</span> PASS (Wallet holding &ge; {bidValue} {currency})</p>
              <p><span className="text-slate-600">Settlement_Engine:</span> Reveal-at-Close</p>
              <p className="text-slate-500 text-[10px] pt-1">
                * Solvency proof verified on-device. Bid amount remains hidden from market until close.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}