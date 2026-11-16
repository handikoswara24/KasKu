"use client";

import { useState } from "react";
import { PlusSquare, Share, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "sidebar" | "compact";
}

export function PWAInstallButton({ variant = "compact" }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === "sidebar"
            ? "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            : "min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        }
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === "sidebar"
              ? "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              : "min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
          }
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0 text-teal-700" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
              <div className="sm:hidden pt-2.5 flex justify-center">
                <span
                  className="w-10 h-1 rounded-full bg-slate-300"
                  aria-hidden="true"
                />
              </div>
              <div className="px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between">
                <h3
                  id="ios-install-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Pasang KasKu di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded"
                  aria-label="Tutup panduan pasang aplikasi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Share className="w-3.5 h-3.5" />
                  </span>
                  <p>
                    1. Ketuk tombol <strong className="text-slate-900">Bagikan</strong> (ikon kotak dengan panah ke atas) di bilah Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </span>
                  <p>
                    2. Gulir ke bawah lalu pilih{" "}
                    <strong className="text-slate-900">Tambahkan ke Layar Utama</strong>, kemudian ketuk{" "}
                    <strong className="text-slate-900">Tambah</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-2 w-full min-h-[42px] rounded-lg bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white transition-colors"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
