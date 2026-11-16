"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Loader2,
  Plus,
  RotateCw,
  ScanLine,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatIDR, getTodayDateISO } from "@/lib/format";
import { compressDataUrlImage, readFileAsDataUrl } from "@/lib/image-utils";
import {
  CreateTransactionInput,
  EXPENSE_CATEGORIES,
  ITEM_TYPE_SUGGESTIONS,
  PAYMENT_METHODS,
  ReceiptItem,
  ReceiptScanResult,
} from "@/types/finance";

interface ReceiptScannerPanelProps {
  onSaveTransaction: (payload: CreateTransactionInput) => Promise<void>;
  onSavedSuccess?: () => void;
}

export function ReceiptScannerPanel({
  onSaveTransaction,
  onSavedSuccess,
}: ReceiptScannerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanCompleted, setScanCompleted] = useState(false);

  // Editable receipt transaction state
  const [merchantName, setMerchantName] = useState("");
  const [date, setDate] = useState(getTodayDateISO());
  const [category, setCategory] = useState<string>("Belanja Harian");
  const [paymentMethod, setPaymentMethod] = useState<string>("QRIS");
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [taxOrService, setTaxOrService] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleOpenCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Browser ini tidak mendukung akses kamera langsung. Silakan unggah foto nota dari perangkat Anda."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError(
        "Izin kamera tidak tersedia atau diblokir oleh iframe/browser. Gunakan tombol Unggah Foto Nota di samping."
      );
    }
  };

  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await loadReceiptImage(rawDataUrl);
  };

  const loadReceiptImage = async (rawDataUrl: string) => {
    setScanError(null);
    setSaveError(null);
    setSaveSuccessMsg(null);
    setScanCompleted(false);
    setZoom(1);
    setRotation(0);

    const compressed = await compressDataUrlImage(rawDataUrl, 1280, 0.84);
    setPreviewDataUrl(compressed);
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScanError("Pilih file gambar yang valid (JPG, PNG, atau WebP).");
      return;
    }
    try {
      const rawUrl = await readFileAsDataUrl(file);
      await loadReceiptImage(rawUrl);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Gagal memuat gambar nota."
      );
    }
  };

  const handleAnalyzeReceipt = async () => {
    if (!previewDataUrl) return;
    setIsScanning(true);
    setScanError(null);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: previewDataUrl }),
      });

      const data = (await res.json()) as ReceiptScanResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal menganalisis foto nota.");
      }

      setMerchantName(data.merchantName || "Toko / Merchant");
      setDate(data.date || getTodayDateISO());
      setCategory(data.suggestedCategory || "Belanja Harian");
      setPaymentMethod(data.paymentMethod || "QRIS");
      setItems(data.items || []);
      setTaxOrService(data.taxOrService || 0);
      setDiscount(data.discount || 0);
      setTotalAmount(data.totalAmount || 0);
      setNotes(data.notes || "");
      setScanCompleted(true);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat analisis nota."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const recalculateTotal = (
    nextItems: ReceiptItem[],
    nextTax: number,
    nextDiscount: number
  ) => {
    const sub = nextItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setTotalAmount(Math.max(0, sub + nextTax - nextDiscount));
  };

  const updateItemField = (
    id: string,
    field: keyof ReceiptItem,
    value: string | number
  ) => {
    const nextItems = items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        const qty = Math.max(1, Number(updated.quantity) || 1);
        const unit = Math.max(0, Number(updated.unitPrice) || 0);
        updated.quantity = qty;
        updated.unitPrice = unit;
        updated.totalPrice = Math.round(qty * unit);
      } else if (field === "totalPrice") {
        updated.totalPrice = Math.max(0, Math.round(Number(value) || 0));
      }
      return updated;
    });
    setItems(nextItems);
    recalculateTotal(nextItems, taxOrService, discount);
  };

  const handleAddEmptyItem = () => {
    const newItem: ReceiptItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      suggestedType: "Lainnya",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    recalculateTotal(next, taxOrService, discount);
  };

  const handleSaveReceiptExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccessMsg(null);

    if (!merchantName.trim()) {
      setSaveError("Nama toko atau keterangan pengeluaran wajib diisi.");
      return;
    }
    if (totalAmount <= 0) {
      setSaveError("Total pengeluaran harus lebih besar dari Rp 0.");
      return;
    }

    setIsSaving(true);
    try {
      const compactThumb = previewDataUrl
        ? await compressDataUrlImage(previewDataUrl, 720, 0.7)
        : undefined;

      await onSaveTransaction({
        type: "expense",
        title: merchantName.trim(),
        merchantName: merchantName.trim(),
        category,
        amount: Math.round(totalAmount),
        date,
        paymentMethod,
        notes: notes.trim() || undefined,
        items: items.filter((i) => i.name.trim().length > 0),
        receiptPreviewUrl: compactThumb,
        taxOrService: taxOrService > 0 ? taxOrService : undefined,
        discount: discount > 0 ? discount : undefined,
      });

      setSaveSuccessMsg("Pengeluaran beserta rincian barang dan pratinjau nota berhasil disimpan.");
      setPreviewDataUrl(null);
      setItems([]);
      setMerchantName("");
      setTaxOrService(0);
      setDiscount(0);
      setTotalAmount(0);
      setNotes("");
      setScanCompleted(false);
      onSavedSuccess?.();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Gagal menyimpan pengeluaran."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const itemsSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="space-y-6">
      {saveSuccessMsg && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            {saveSuccessMsg}
          </span>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
            aria-label="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Capture / Upload + Receipt Preview */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Foto & Pratinjau Nota
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ambil foto struk belanja atau unggah gambar untuk pratinjau.
              </p>
            </div>
            {previewDataUrl && (
              <button
                type="button"
                onClick={() => {
                  setPreviewDataUrl(null);
                  setScanCompleted(false);
                }}
                className="text-xs font-medium text-slate-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors whitespace-nowrap shrink-0"
              >
                Ganti Foto
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void handleFileChange(file);
              e.target.value = "";
            }}
          />

          {/* Camera Live Viewfinder */}
          {cameraOpen ? (
            <div className="mt-5 space-y-3">
              <div className="relative bg-slate-950 rounded-lg overflow-hidden aspect-[3/4] flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Ambil Foto Nota
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : !previewDataUrl ? (
            /* Upload / Capture Dropzone */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                void handleFileChange(file);
              }}
              className="mt-5 border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-xl p-8 text-center transition-colors bg-slate-50/70"
            >
              <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center mx-auto text-teal-700">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-4">
                Unggah atau Foto Nota Belanja
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Seret gambar ke area ini, pilih dari galeri, atau gunakan kamera langsung untuk membuat pratinjau nota.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Pilih Gambar Nota
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Buka Kamera
                </button>
              </div>

              {cameraError && (
                <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-left">
                  {cameraError}
                </p>
              )}
            </div>
          ) : (
            /* Active Receipt Preview Frame */
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-slate-600">
                  Pratinjau Nota
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded"
                    aria-label="Perkecil pratinjau"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 w-10 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded"
                    aria-label="Perbesar pratinjau"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded ml-1"
                    aria-label="Putar pratinjau 90 derajat"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative bg-slate-900/5 border border-slate-200 rounded-lg overflow-auto max-h-[460px] flex items-center justify-center p-4">
                <img
                  src={previewDataUrl}
                  alt="Pratinjau foto nota belanja"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[420px] object-contain rounded shadow-sm transition-transform duration-150"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={handleAnalyzeReceipt}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-teal-700/60 rounded-lg transition-colors"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menganalisis Barang & Total Nota...
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4" />
                    {scanCompleted
                      ? "Analisis Ulang Foto Nota"
                      : "Analisis Nota & Beri Saran Tipe"}
                  </>
                )}
              </button>

              {scanError && (
                <div
                  role="alert"
                  className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5"
                >
                  {scanError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Extracted Items, Type Suggestions & Save Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Rincian Barang, Saran Tipe & Total Pengeluaran
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Periksa atau sesuaikan daftar barang hasil pemindaian sebelum disimpan ke buku kas.
              </p>
            </div>
            {scanCompleted && (
              <span className="text-xs font-medium text-teal-700">
                Terbaca otomatis dari nota
              </span>
            )}
          </div>

          {!previewDataUrl && items.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                <ScanLine className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-4">
                Belum Ada Nota Dipilih
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Unggah atau ambil foto nota di panel sebelah kiri, lalu klik{" "}
                <strong className="text-slate-700 font-medium">
                  Analisis Nota & Beri Saran Tipe
                </strong>{" "}
                untuk mengekstrak daftar barang, saran tipe item, dan total pengeluarannya secara otomatis.
              </p>
            </div>
          ) : isScanning ? (
            <div className="py-8 space-y-4 animate-pulse">
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
              </div>
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-12 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <form onSubmit={handleSaveReceiptExpense} className="mt-5 space-y-5">
              {/* Merchant & Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nama Toko / Keterangan
                  </label>
                  <input
                    type="text"
                    required
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Contoh: Indomaret, Kopi Kenangan"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tanggal Nota
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kategori Utama Pengeluaran
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
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
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Extracted Items with Suggested Types */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-xs font-semibold text-slate-800">
                    Barang yang Dibeli & Saran Tipe ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddEmptyItem}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 px-2.5 py-1 rounded-md hover:bg-teal-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Barang
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    Klik &ldquo;Analisis Nota & Beri Saran Tipe&rdquo; untuk membaca daftar barang otomatis, atau tambah barang secara manual.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white hover:bg-slate-50/70 transition-colors space-y-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-xs font-mono text-slate-400 pt-2 w-5 shrink-0">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-6">
                              <label className="sr-only">Nama barang</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateItemField(item.id, "name", e.target.value)
                                }
                                placeholder="Nama barang"
                                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="sr-only">Jumlah</label>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    "quantity",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                                title="Jumlah"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="sr-only">Subtotal item</label>
                              <input
                                type="number"
                                min={0}
                                value={item.totalPrice}
                                onChange={(e) =>
                                  updateItemField(
                                    item.id,
                                    "totalPrice",
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums text-right border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                                title="Total harga item (Rp)"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 rounded transition-colors shrink-0"
                            aria-label="Hapus barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="pl-7 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-500">
                              Saran Tipe:
                            </span>
                            <select
                              value={item.suggestedType}
                              onChange={(e) =>
                                updateItemField(
                                  item.id,
                                  "suggestedType",
                                  e.target.value
                                )
                              }
                              className="text-xs font-medium text-teal-800 bg-teal-50/70 border border-teal-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-600"
                            >
                              {ITEM_TYPE_SUGGESTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                              {!ITEM_TYPE_SUGGESTIONS.includes(
                                item.suggestedType as (typeof ITEM_TYPE_SUGGESTIONS)[number]
                              ) && (
                                <option value={item.suggestedType}>
                                  {item.suggestedType}
                                </option>
                              )}
                            </select>
                          </div>
                          {item.typeReason && (
                            <span className="text-[11px] text-slate-500">
                              {item.typeReason}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tax, Discount, Total Pengeluaran */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Subtotal Barang
                    </label>
                    <div className="px-3 py-1.5 text-sm font-mono tabular-nums text-slate-700 bg-white border border-slate-200 rounded-lg">
                      {formatIDR(itemsSubtotal)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Pajak / Layanan (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={taxOrService}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setTaxOrService(val);
                        recalculateTotal(items, val, discount);
                      }}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setDiscount(val);
                        recalculateTotal(items, taxOrService, val);
                      }}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Total Pengeluaran Nota (Rp)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Nominal ini akan dicatat sebagai pengeluaran
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">Rp</span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={totalAmount}
                      onChange={(e) =>
                        setTotalAmount(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-44 px-3 py-2 text-base font-mono font-semibold tabular-nums text-right text-rose-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ringkasan belanja atau catatan pribadi"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5"
                >
                  {saveError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-teal-700/60 rounded-lg transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan ke Database...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Simpan Pengeluaran & Nota
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
