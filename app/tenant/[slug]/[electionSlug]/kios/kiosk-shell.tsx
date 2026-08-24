"use client";

import React from "react";

export function KioskShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-foreground text-background flex flex-col justify-between overflow-hidden select-none">
      {/* Header Kios Terkunci */}
      <header className="border-b border-background/10 py-4 px-6 bg-black flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-background/60">TPS Offline Mode</span>
        </div>
        <div className="font-display font-black text-sm tracking-tight text-background">
          Ayo<span className="text-primary font-bold">Pilih</span>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Footer Kios */}
      <footer className="border-t border-background/10 py-4 px-6 text-center text-xs text-background/40 bg-black font-mono">
        Perangkat Kios TPS Terkunci — Didukung oleh AyoPilih
      </footer>
    </div>
  );
}
