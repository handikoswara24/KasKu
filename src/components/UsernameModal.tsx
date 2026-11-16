"use client";

import { useEffect, useState } from "react";
import { User, X } from "lucide-react";

interface UsernameModalProps {
  open: boolean;
  currentUsername: string;
  reasonMessage?: string | null;
  onClose: () => void;
  onSave: (username: string) => void;
  onClear?: () => void;
}

export function UsernameModal({
  open,
  currentUsername,
  reasonMessage,
  onClose,
  onSave,
  onClear,
}: UsernameModalProps) {
  const [inputValue, setInputValue] = useState(currentUsername);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInputValue(currentUsername);
    setError(null);
  }, [open, currentUsername]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputValue.trim();
    if (cleaned.length < 2) {
      setError("Username minimal 2 karakter.");
      return;
    }
    if (cleaned.length > 40) {
      setError("Username maksimal 40 karakter.");
      return;
    }
    onSave(cleaned);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
        <div className="sm:hidden pt-2.5 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        <div className="px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </span>
            <h2
              id="username-modal-title"
              className="text-sm font-semibold text-slate-900 truncate"
            >
              {currentUsername ? "Ubah Username Pencatat" : "Atur Username Pencatat"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Tutup dialog username"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {reasonMessage && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
              {reasonMessage}
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            Username disimpan di browser perangkat ini (<code className="font-mono text-[11px] text-slate-800">localStorage</code>) untuk mencatat siapa yang melakukan setiap transaksi.
          </p>

          <div>
            <label
              htmlFor="kasku-username-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Username / Nama Anda
            </label>
            <input
              id="kasku-username-input"
              type="text"
              autoFocus
              maxLength={40}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Contoh: Handi, Rina, Budi"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-100">
            <div>
              {currentUsername && onClear && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  className="w-full sm:w-auto min-h-[42px] px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Hapus Username
                </button>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Simpan Username
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
