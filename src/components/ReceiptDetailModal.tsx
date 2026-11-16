"use client";

import { FileText, X } from "lucide-react";
import { formatDateID, formatIDR } from "@/lib/format";
import { TransactionRecord } from "@/types/finance";

interface ReceiptDetailModalProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
}

export function ReceiptDetailModal({
  transaction,
  onClose,
}: ReceiptDetailModalProps) {
  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-detail-title"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="sm:hidden pt-2.5 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="receipt-detail-title"
              className="text-base font-semibold text-slate-900 truncate"
            >
              {transaction.merchantName || transaction.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {formatDateID(transaction.date)}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {transaction.category}
              <span className="mx-1.5" aria-hidden="true">·</span>
              {transaction.paymentMethod}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Tutup rincian nota"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left: Stored Receipt Photo Preview */}
          <div className="md:col-span-5">
            <div className="text-xs font-medium text-slate-700 mb-2">
              Pratinjau Foto Nota
            </div>
            {transaction.receiptPreviewUrl ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-center">
                <img
                  src={transaction.receiptPreviewUrl}
                  alt={`Foto nota ${transaction.title}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[320px] sm:max-h-[420px] w-auto object-contain rounded"
                />
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  Transaksi ini dicatat manual tanpa lampiran foto nota.
                </p>
              </div>
            )}
          </div>

          {/* Right: Itemized List & Type Suggestions */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-2.5">
                Rincian Barang & Tipe Item
              </h3>

              {transaction.items && transaction.items.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {transaction.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {item.name}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          <span className="text-teal-800 font-medium">
                            {item.suggestedType}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {item.quantity}x
                          </span>
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                        {formatIDR(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  Tidak ada rincian item terpisah pada transaksi ini.
                </p>
              )}

              {transaction.notes && (
                <div className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                  <span className="font-medium text-slate-800">Catatan: </span>
                  {transaction.notes}
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs">
              {transaction.taxOrService ? (
                <div className="flex justify-between text-slate-600">
                  <span>Pajak / Biaya Layanan</span>
                  <span className="font-mono tabular-nums">
                    {formatIDR(transaction.taxOrService)}
                  </span>
                </div>
              ) : null}
              {transaction.discount ? (
                <div className="flex justify-between text-emerald-700">
                  <span>Diskon</span>
                  <span className="font-mono tabular-nums">
                    -{formatIDR(transaction.discount)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 text-sm font-semibold">
                <span className="text-slate-900">
                  Total {transaction.type === "income" ? "Pemasukan" : "Pengeluaran"}
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    transaction.type === "income"
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatIDR(transaction.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
