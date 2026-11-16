"use client";

import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import { getTodayDateISO } from "@/lib/format";
import {
  CreateTransactionInput,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TransactionRecord,
  TransactionType,
} from "@/types/finance";

interface ManualTransactionModalProps {
  open: boolean;
  username: string;
  onRequestUsername?: () => void;
  initialRecord?: TransactionRecord | null;
  onClose: () => void;
  onSubmit: (payload: CreateTransactionInput, editId?: string) => Promise<void>;
}

export function ManualTransactionModal({
  open,
  username,
  onRequestUsername,
  initialRecord,
  onClose,
  onSubmit,
}: ManualTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(getTodayDateISO());
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialRecord) {
      setType(initialRecord.type);
      setTitle(initialRecord.title);
      setCategory(initialRecord.category);
      setAmount(String(initialRecord.amount));
      setDate(initialRecord.date);
      setPaymentMethod(initialRecord.paymentMethod || PAYMENT_METHODS[0]);
      setNotes(initialRecord.notes || "");
    } else {
      setType("expense");
      setTitle("");
      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount("");
      setDate(getTodayDateISO());
      setPaymentMethod(PAYMENT_METHODS[0]);
      setNotes("");
    }
  }, [open, initialRecord]);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const nextList =
      nextType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!(nextList as readonly string[]).includes(category)) {
      setCategory(nextList[0]);
    }
  };

  if (!open) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeUsername = username.trim();
    if (!activeUsername) {
      setError("Username belum diatur. Isi username terlebih dahulu untuk bisa mencatat transaksi.");
      return;
    }

    const parsedAmount = Math.round(Number(amount));
    if (!title.trim()) {
      setError("Keterangan transaksi wajib diisi.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Nominal harus berupa angka lebih dari 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          username: activeUsername,
          type,
          title: title.trim(),
          category,
          amount: parsedAmount,
          date,
          paymentMethod,
          notes: notes.trim() || undefined,
        },
        initialRecord?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan transaksi."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-tx-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="sm:hidden pt-2.5 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <h2 id="manual-tx-title" className="text-base font-semibold text-slate-900">
            {initialRecord ? "Edit Transaksi" : "Catat Transaksi Keuangan"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {username.trim() ? (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="inline-flex items-center gap-2 text-slate-600 min-w-0">
                <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">
                  Dicatat oleh:{" "}
                  <strong className="text-slate-900 font-semibold">
                    {username}
                  </strong>
                </span>
              </span>
              {onRequestUsername && (
                <button
                  type="button"
                  onClick={onRequestUsername}
                  className="text-teal-700 hover:underline font-medium shrink-0"
                >
                  Ubah
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <span>
                Belum ada username. Atur username terlebih dahulu untuk bisa mencatat transaksi.
              </span>
              {onRequestUsername && (
                <button
                  type="button"
                  onClick={onRequestUsername}
                  className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shrink-0"
                >
                  Atur Username
                </button>
              )}
            </div>
          )}

          {/* Segmented Type Selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeSwitch("expense")}
              className={`min-h-[40px] py-2 text-xs font-medium rounded-md transition-colors ${
                type === "expense"
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch("income")}
              className={`min-h-[40px] py-2 text-xs font-medium rounded-md transition-colors ${
                type === "income"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pemasukan
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {type === "income" ? "Sumber Pemasukan" : "Keterangan / Toko"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "income"
                  ? "Contoh: Gaji Bulanan, Proyek Desain"
                  : "Contoh: Makan Siang, Bayar Listrik"
              }
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nominal (Rp)
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail tambahan jika diperlukan"
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

          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm sm:text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !username.trim()}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm sm:text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-teal-700/50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {initialRecord ? "Simpan Perubahan" : "Simpan Transaksi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
