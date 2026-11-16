"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Camera,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { ManualTransactionModal } from "@/components/ManualTransactionModal";
import { MonthlyCharts } from "@/components/MonthlyCharts";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { PWARegister } from "@/components/PWARegister";
import { ReceiptDetailModal } from "@/components/ReceiptDetailModal";
import { ReceiptScannerPanel } from "@/components/ReceiptScannerPanel";
import { UsernameModal } from "@/components/UsernameModal";
import { useUsername } from "@/hooks/useUsername";
import {
  formatDateID,
  formatIDR,
  formatMonthLabel,
  getCurrentMonthKey,
  getRecentMonthKeys,
} from "@/lib/format";
import { exportFinanceReportPDF } from "@/lib/pdf-export";
import {
  CategoryAggregate,
  CreateTransactionInput,
  MonthlyAggregate,
  StorageMode,
  TransactionRecord,
} from "@/types/finance";

type WorkspaceTab = "overview" | "scanner" | "ledger";
type TypeFilter = "all" | "income" | "expense";

interface FinanceWorkspaceProps {
  initialTransactions?: TransactionRecord[];
  initialStorageMode?: StorageMode;
  initialError?: string | null;
  currentMonthKey?: string;
  imagekitConfigured?: boolean;
}

function resolveDefaultMonth(
  records: TransactionRecord[] | undefined,
  currentMonth: string
): string {
  if (!records || records.length === 0) return currentMonth;
  const hasCurrentMonth = records.some((tx) => tx.date.startsWith(currentMonth));
  return hasCurrentMonth ? currentMonth : "all";
}

export function FinanceWorkspace({
  initialTransactions,
  initialStorageMode = "local-fallback",
  initialError = null,
  currentMonthKey,
  imagekitConfigured = false,
}: FinanceWorkspaceProps) {
  const fallbackMonth = currentMonthKey ?? getCurrentMonthKey();
  const hasInitialData = initialTransactions !== undefined;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [transactions, setTransactions] = useState<TransactionRecord[]>(
    initialTransactions ?? []
  );
  const [storageMode, setStorageMode] = useState<StorageMode>(initialStorageMode);
  const [isImagekitReady, setIsImagekitReady] = useState(imagekitConfigured);
  const [isLoading, setIsLoading] = useState(!hasInitialData);
  const [loadError, setLoadError] = useState<string | null>(initialError);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    resolveDefaultMonth(initialTransactions, fallbackMonth)
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Username (localStorage)
  const {
    username,
    hasUsername,
    isLoaded: isUsernameLoaded,
    saveUsername,
    clearUsername,
  } = useUsername();
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [usernameModalReason, setUsernameModalReason] = useState<string | null>(
    null
  );
  const [pendingManualAfterUsername, setPendingManualAfterUsername] =
    useState(false);

  // Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TransactionRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<TransactionRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mongoInfoOpen, setMongoInfoOpen] = useState(false);

  const openUsernamePrompt = (
    reason?: string | null,
    continueToManual = false
  ) => {
    setUsernameModalReason(reason ?? null);
    setPendingManualAfterUsername(continueToManual);
    setUsernameModalOpen(true);
  };

  const handleOpenManualTransaction = (record: TransactionRecord | null = null) => {
    setEditingRecord(record);
    if (!hasUsername) {
      openUsernamePrompt(
        "Belum ada username. Isi username terlebih dahulu untuk bisa mencatat transaksi.",
        true
      );
      return;
    }
    setManualModalOpen(true);
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/transactions", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        transactions?: TransactionRecord[];
        storageMode?: StorageMode;
        imagekitConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data transaksi.");
      }
      setTransactions(data.transactions ?? []);
      if (data.storageMode) {
        setStorageMode(data.storageMode);
      }
      if (data.imagekitConfigured !== undefined) {
        setIsImagekitReady(data.imagekitConfigured);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setLoadError(
          "Koneksi ke database melebihi batas waktu (10 detik). Silakan coba muat ulang."
        );
      } else {
        setLoadError(
          err instanceof Error ? err.message : "Terjadi kesalahan jaringan."
        );
      }
    } finally {
      clearTimeout(timer);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasInitialData) {
      void fetchTransactions();
    }
  }, [hasInitialData, fetchTransactions]);

  const handleSaveTransaction = async (
    payload: CreateTransactionInput,
    editId?: string
  ) => {
    if (editId) {
      const res = await fetch(`/api/transactions/${encodeURIComponent(editId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        transaction?: TransactionRecord;
        storageMode?: StorageMode;
        error?: string;
      };
      if (!res.ok || !data.transaction) {
        throw new Error(data.error || "Gagal memperbarui transaksi.");
      }
      setTransactions((prev) =>
        prev.map((item) => (item.id === editId ? data.transaction! : item))
      );
      if (data.storageMode) setStorageMode(data.storageMode);
      return;
    }

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      transaction?: TransactionRecord;
      storageMode?: StorageMode;
      error?: string;
    };
    if (!res.ok || !data.transaction) {
      throw new Error(data.error || "Gagal menyimpan transaksi.");
    }
    setTransactions((prev) => [data.transaction!, ...prev]);
    if (data.storageMode) setStorageMode(data.storageMode);
    if (payload.date && selectedMonth !== "all") {
      const txMonth = payload.date.slice(0, 7);
      if (txMonth !== selectedMonth) {
        setSelectedMonth(txMonth);
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { deleted?: boolean; error?: string };
      if (!res.ok || !data.deleted) {
        throw new Error(data.error || "Gagal menghapus transaksi.");
      }
      setTransactions((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Gagal menghapus transaksi."
      );
    }
  };

  const monthOptions = useMemo(() => {
    const set = new Set<string>(getRecentMonthKeys(6));
    transactions.forEach((tx) => {
      const key = tx.date.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key)) set.add(key);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const periodTransactions = useMemo(() => {
    if (selectedMonth === "all") return transactions;
    return transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const visibleTransactions = useMemo(() => {
    return periodTransactions.filter((tx) => {
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.username ?? "").toLowerCase().includes(q) ||
        (tx.merchantName ?? "").toLowerCase().includes(q) ||
        (tx.sourcePlatform ?? "").toLowerCase().includes(q) ||
        (tx.serviceLabel ?? "").toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.notes ?? "").toLowerCase().includes(q) ||
        (tx.items ?? []).some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [periodTransactions, typeFilter, searchQuery]);

  const { totalIncome, totalExpense, netBalance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of periodTransactions) {
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    }
    return {
      totalIncome: income,
      totalExpense: expense,
      netBalance: income - expense,
    };
  }, [periodTransactions]);

  const monthlyAggregates: MonthlyAggregate[] = useMemo(() => {
    const latestTxMonth = transactions[0]?.date?.slice(0, 7);
    const anchor =
      selectedMonth !== "all"
        ? selectedMonth
        : latestTxMonth && /^\d{4}-\d{2}$/.test(latestTxMonth)
        ? latestTxMonth
        : fallbackMonth;
    const keys = getRecentMonthKeys(6, anchor);

    return keys.map((key) => {
      let income = 0;
      let expense = 0;
      let count = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(key)) {
          count += 1;
          if (tx.type === "income") income += tx.amount;
          else expense += tx.amount;
        }
      }
      return {
        monthKey: key,
        label: formatMonthLabel(key, false),
        shortLabel: formatMonthLabel(key, true),
        income,
        expense,
        net: income - expense,
        count,
      };
    });
  }, [transactions, selectedMonth]);

  const categoryBreakdown: CategoryAggregate[] = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    let expenseSum = 0;

    for (const tx of periodTransactions) {
      if (tx.type !== "expense") continue;
      expenseSum += tx.amount;
      const current = map.get(tx.category) ?? { amount: 0, count: 0 };
      map.set(tx.category, {
        amount: current.amount + tx.amount,
        count: current.count + 1,
      });
    }

    return Array.from(map.entries())
      .map(([category, stats]) => ({
        category,
        amount: stats.amount,
        count: stats.count,
        percentage: expenseSum > 0 ? (stats.amount / expenseSum) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  const activePeriodLabel =
    selectedMonth === "all"
      ? "Semua Periode"
      : formatMonthLabel(selectedMonth, false);

  const handleExportPdf = () => {
    exportFinanceReportPDF({
      transactions: visibleTransactions,
      periodLabel: activePeriodLabel,
      selectedMonth,
      totalIncome,
      totalExpense,
      netBalance,
      categoryBreakdown,
    });
  };

  const tabTitles: Record<WorkspaceTab, string> = {
    overview: "Ringkasan & Grafik",
    scanner: "Foto & Pindai Nota",
    ledger: "Buku Kas",
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      <PWARegister />
      <OfflineIndicator />
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col bg-white border-r border-slate-200 justify-between">
        <div>
          <div className="h-16 px-6 flex items-center border-b border-slate-200">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              KasKu
            </span>
          </div>

          <nav className="p-4 space-y-1" aria-label="Navigasi utama">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Ringkasan & Grafik
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scanner")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "scanner"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              Foto & Pindai Nota
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === "ledger"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              Buku Kas
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={() => openUsernamePrompt()}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
              hasUsername
                ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                : "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 shrink-0 text-teal-700" />
              <span className="truncate font-medium">
                {hasUsername ? username : "Atur Username"}
              </span>
            </span>
            <span className="text-[11px] text-teal-700 font-medium shrink-0">
              {hasUsername ? "Ubah" : "Wajib"}
            </span>
          </button>
          <PWAInstallButton variant="sidebar" />
          <button
            type="button"
            onClick={() => setMongoInfoOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors text-left"
          >
            <Database className="w-4 h-4 shrink-0 text-slate-500" />
            <span className="truncate">
              {storageMode === "mongodb"
                ? "Database: MongoDB"
                : "Database: Lokal (MongoDB Siap)"}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar (non-sticky on mobile so total sticky chrome <= 15%) */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="lg:hidden text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              KasKu
            </span>
            <span className="hidden lg:inline text-sm text-slate-400 whitespace-nowrap">
              KasKu
            </span>
            <span className="hidden lg:inline text-slate-300" aria-hidden="true">
              /
            </span>
            <h1 className="hidden sm:block text-sm font-semibold text-slate-900 truncate">
              {tabTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openUsernamePrompt()}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                hasUsername
                  ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
              }`}
              title="Ubah username pencatat transaksi"
            >
              <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="max-w-[120px] truncate">
                {hasUsername ? username : "Atur Username"}
              </span>
            </button>

            {/* Desktop Period Selector in Header */}
            <label htmlFor="period-select-desktop" className="sr-only">
              Pilih Periode Bulan
            </label>
            <select
              id="period-select-desktop"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="hidden lg:block px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 whitespace-nowrap shrink-0"
            >
              <option value="all">Semua Periode</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key, false)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={visibleTransactions.length === 0}
              className="min-h-[40px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenManualTransaction(null)}
              className="min-h-[40px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Catat Transaksi</span>
              <span className="sm:hidden">Catat</span>
            </button>
          </div>
        </header>

        {/* Main Viewport (pb-24 on mobile to clear fixed bottom tab bar) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-[1360px] w-full mx-auto space-y-4 sm:space-y-6">
          {/* Mobile Context Toolbar: Page Title + Period Filter + DB & Username Info */}
          <div className="lg:hidden flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {tabTitles[activeTab]}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => openUsernamePrompt()}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    hasUsername
                      ? "text-teal-700 hover:text-teal-800"
                      : "text-amber-700 hover:text-amber-800"
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span className="max-w-[110px] truncate">
                    {hasUsername ? username : "Atur Username"}
                  </span>
                </button>
                <span className="text-slate-300 text-[11px]" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setMongoInfoOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
                >
                  <Database className="w-3 h-3" />
                  <span>
                    {storageMode === "mongodb" ? "MongoDB Aktif" : "Penyimpanan Lokal"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton variant="compact" />
              {activeTab !== "scanner" && (
                <div>
                  <label htmlFor="period-select-mobile" className="sr-only">
                    Pilih Periode Bulan
                  </label>
                  <select
                    id="period-select-mobile"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="all">Semua Periode</option>
                    {monthOptions.map((key) => (
                      <option key={key} value={key}>
                        {formatMonthLabel(key, false)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {isUsernameLoaded && !hasUsername && (
            <div
              role="status"
              className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl px-4 py-3 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Username pencatat belum diatur di perangkat ini. Isi username terlebih dahulu untuk bisa menginput transaksi.
                </span>
              </div>
              <button
                type="button"
                onClick={() => openUsernamePrompt()}
                className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Atur Username
              </button>
            </div>
          )}

          {loadError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void fetchTransactions()}
                className="min-h-[40px] text-xs font-medium px-3 py-1.5 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 shrink-0"
              >
                Muat Ulang
              </button>
            </div>
          )}

          {activeTab === "scanner" ? (
            <ReceiptScannerPanel
              username={username}
              onRequestUsername={() =>
                openUsernamePrompt(
                  "Isi username terlebih dahulu agar hasil pemindaian nota dapat disimpan sebagai transaksi."
                )
              }
              imagekitConfigured={isImagekitReady}
              onSaveTransaction={async (payload) => {
                await handleSaveTransaction(payload);
              }}
            />
          ) : (
            <>
              {/* Overview KPI Strip + Charts */}
              {activeTab === "overview" && (
                <>
                  <section
                    aria-label="Ringkasan Keuangan"
                    className="grid grid-cols-1 md:grid-cols-3 bg-white border border-slate-200 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200"
                  >
                    <div className="p-4 sm:p-6">
                      <span className="text-xs font-medium text-slate-500 block">
                        Total Pemasukan · {activePeriodLabel}
                      </span>
                      <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700">
                        +{formatIDR(totalIncome)}
                      </div>
                      <span className="mt-1 text-xs text-slate-500 block">
                        {
                          periodTransactions.filter((t) => t.type === "income")
                            .length
                        }{" "}
                        transaksi pemasukan
                      </span>
                    </div>

                    <div className="p-4 sm:p-6">
                      <span className="text-xs font-medium text-slate-500 block">
                        Total Pengeluaran · {activePeriodLabel}
                      </span>
                      <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-700">
                        -{formatIDR(totalExpense)}
                      </div>
                      <span className="mt-1 text-xs text-slate-500 block">
                        {
                          periodTransactions.filter((t) => t.type === "expense")
                            .length
                        }{" "}
                        transaksi pengeluaran
                      </span>
                    </div>

                    <div className="p-4 sm:p-6">
                      <span className="text-xs font-medium text-slate-500 block">
                        Saldo Bersih · {activePeriodLabel}
                      </span>
                      <div
                        className={`mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                          netBalance >= 0 ? "text-teal-700" : "text-rose-700"
                        }`}
                      >
                        {netBalance >= 0 ? "+" : ""}
                        {formatIDR(netBalance)}
                      </div>
                      <span className="mt-1 text-xs text-slate-500 block">
                        Selisih pemasukan dikurangi pengeluaran
                      </span>
                    </div>
                  </section>

                  <MonthlyCharts
                    monthlyData={monthlyAggregates}
                    categoryData={categoryBreakdown}
                    selectedMonth={selectedMonth}
                    onSelectMonth={setSelectedMonth}
                    totalExpense={totalExpense}
                  />
                </>
              )}

              {/* Ledger Section */}
              <section
                aria-label="Daftar Transaksi Keuangan"
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Catatan Pemasukan & Pengeluaran
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activePeriodLabel}
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      {visibleTransactions.length} entri ditampilkan
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari toko, barang, kategori..."
                        className="w-full sm:w-60 min-h-[42px] sm:min-h-[36px] pl-9 pr-3 py-1.5 text-base sm:text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>

                    {/* Segmented Type Filter */}
                    <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          { id: "all", label: "Semua" },
                          { id: "income", label: "Pemasukan" },
                          { id: "expense", label: "Pengeluaran" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTypeFilter(tab.id)}
                          className={`min-h-[36px] sm:min-h-[30px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap text-center ${
                            typeFilter === tab.id
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-4 sm:p-6 space-y-3 animate-pulse">
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} className="h-11 bg-slate-100 rounded-lg" />
                    ))}
                  </div>
                ) : visibleTransactions.length === 0 ? (
                  <div className="py-12 sm:py-16 px-4 sm:px-6 text-center max-w-md mx-auto">
                    <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-4">
                      {transactions.length > 0 && selectedMonth !== "all"
                        ? `Tidak Ada Transaksi pada ${activePeriodLabel}`
                        : "Belum Ada Catatan Keuangan"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {transactions.length > 0 && selectedMonth !== "all"
                        ? `Terdapat ${transactions.length} transaksi tersimpan di periode lain. Tampilkan semua periode untuk melihat seluruh riwayat.`
                        : "Mulai catat pemasukan dan pengeluaran Anda secara manual atau foto nota belanja untuk mengekstrak daftar barang otomatis."}
                    </p>
                    <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
                      {transactions.length > 0 && selectedMonth !== "all" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMonth("all");
                            setTypeFilter("all");
                            setSearchQuery("");
                          }}
                          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Tampilkan Semua Periode ({transactions.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveTab("scanner")}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          transactions.length > 0 && selectedMonth !== "all"
                            ? "text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                            : "text-white bg-teal-700 hover:bg-teal-800"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Foto / Pindai Nota
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenManualTransaction(null)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Catat Transaksi
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card List (no horizontal scroll on phones) */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {visibleTransactions.map((tx) => (
                        <div key={tx.id} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 leading-snug break-words">
                                {tx.title}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-mono tabular-nums">
                                  {formatDateID(tx.date)}
                                </span>
                                {tx.username && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-700 font-medium">
                                      Oleh: {tx.username}
                                    </span>
                                  </>
                                )}
                                {tx.sourcePlatform && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-700 font-medium">
                                      {tx.sourcePlatform}
                                      {tx.serviceLabel ? ` (${tx.serviceLabel})` : ""}
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>{tx.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>{tx.paymentMethod}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                                  tx.type === "income"
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {tx.type === "income" ? "+" : "-"}
                                {formatIDR(tx.amount)}
                              </div>
                              <span
                                className={`text-[11px] font-medium block mt-0.5 ${
                                  tx.type === "income"
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {tx.type === "income" ? "Pemasukan" : "Pengeluaran"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div>
                              {tx.items && tx.items.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setDetailRecord(tx)}
                                  className="min-h-[36px] text-xs font-medium text-teal-700 hover:underline inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {tx.items.length} barang nota
                                </button>
                              )}
                            </div>

                            {confirmDeleteId === tx.id ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTransaction(tx.id)}
                                  className="min-h-[40px] text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[40px] text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                {(tx.receiptPreviewUrl ||
                                  (tx.items && tx.items.length > 0)) && (
                                  <button
                                    type="button"
                                    onClick={() => setDetailRecord(tx)}
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-teal-700 rounded-lg hover:bg-teal-50 transition-colors"
                                    aria-label="Lihat pratinjau nota"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRecord(tx);
                                    setManualModalOpen(true);
                                  }}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                                  aria-label="Edit transaksi"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(tx.id)}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
                                  aria-label="Hapus transaksi"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop/Tablet High-Density Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                            <th className="py-3 px-5 whitespace-nowrap">Tanggal</th>
                            <th className="py-3 px-4">Keterangan & Rincian</th>
                            <th className="py-3 px-4 whitespace-nowrap">Tipe</th>
                            <th className="py-3 px-4 text-right whitespace-nowrap">
                              Nominal
                            </th>
                            <th className="py-3 px-5 text-right whitespace-nowrap">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {visibleTransactions.map((tx) => (
                            <tr
                              key={tx.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-5 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                                {formatDateID(tx.date)}
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900 leading-snug">
                                  {tx.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                                  {tx.username && (
                                    <>
                                      <span className="text-slate-700 font-medium">
                                        Oleh: {tx.username}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  {tx.sourcePlatform && (
                                    <>
                                      <span className="text-slate-700 font-medium">
                                        {tx.sourcePlatform}
                                        {tx.serviceLabel ? ` (${tx.serviceLabel})` : ""}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  <span>{tx.category}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{tx.paymentMethod}</span>
                                  {tx.items && tx.items.length > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <button
                                        type="button"
                                        onClick={() => setDetailRecord(tx)}
                                        className="text-teal-700 hover:underline font-medium"
                                      >
                                        {tx.items.length} barang nota
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-xs whitespace-nowrap">
                                <span
                                  className={
                                    tx.type === "income"
                                      ? "font-medium text-emerald-700"
                                      : "font-medium text-rose-700"
                                  }
                                >
                                  {tx.type === "income"
                                    ? "Pemasukan"
                                    : "Pengeluaran"}
                                </span>
                              </td>

                              <td
                                className={`py-3 px-4 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                                  tx.type === "income"
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {tx.type === "income" ? "+" : "-"}
                                {formatIDR(tx.amount)}
                              </td>

                              <td className="py-3 px-5 text-right whitespace-nowrap">
                                {confirmDeleteId === tx.id ? (
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteTransaction(tx.id)
                                      }
                                      className="text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 px-2.5 py-1 rounded transition-colors"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    {(tx.receiptPreviewUrl ||
                                      (tx.items && tx.items.length > 0)) && (
                                      <button
                                        type="button"
                                        onClick={() => setDetailRecord(tx)}
                                        className="p-1.5 text-slate-400 hover:text-teal-700 rounded hover:bg-teal-50 transition-colors"
                                        title="Lihat pratinjau nota & rincian barang"
                                        aria-label="Lihat pratinjau nota"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRecord(tx);
                                        setManualModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
                                      title="Edit transaksi"
                                      aria-label="Edit transaksi"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(tx.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors"
                                      title="Hapus transaksi"
                                      aria-label="Hapus transaksi"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Tab Bar (Thumb-Zone Navigation, <= 15% mobile height) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-3 h-16"
      >
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === "overview"
              ? "text-teal-700 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[11px] leading-none">Ringkasan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === "scanner"
              ? "text-teal-700 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[11px] leading-none">Foto Nota</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            activeTab === "ledger"
              ? "text-teal-700 font-semibold"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-[11px] leading-none">Buku Kas</span>
        </button>
      </nav>

      {/* Add / Edit Transaction Modal */}
      <ManualTransactionModal
        open={manualModalOpen}
        username={username}
        onRequestUsername={() =>
          openUsernamePrompt(
            "Isi username terlebih dahulu sebelum mencatat transaksi."
          )
        }
        initialRecord={editingRecord}
        onClose={() => {
          setManualModalOpen(false);
          setEditingRecord(null);
        }}
        onSubmit={handleSaveTransaction}
      />

      {/* LocalStorage Username Modal */}
      <UsernameModal
        open={usernameModalOpen}
        currentUsername={username}
        reasonMessage={usernameModalReason}
        onClose={() => {
          setUsernameModalOpen(false);
          setUsernameModalReason(null);
          setPendingManualAfterUsername(false);
        }}
        onSave={(nextName) => {
          saveUsername(nextName);
          setUsernameModalOpen(false);
          setUsernameModalReason(null);
          if (pendingManualAfterUsername) {
            setPendingManualAfterUsername(false);
            setManualModalOpen(true);
          }
        }}
        onClear={() => {
          clearUsername();
          setPendingManualAfterUsername(false);
        }}
      />

      {/* Receipt Preview & Item Detail Modal */}
      <ReceiptDetailModal
        transaction={detailRecord}
        onClose={() => setDetailRecord(null)}
      />

      {/* MongoDB Connection Info Modal */}
      {mongoInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mongo-info-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden">
            <div className="sm:hidden pt-2.5 flex justify-center">
              <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
            </div>
            <div className="px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between">
              <h2
                id="mongo-info-title"
                className="text-sm font-semibold text-slate-900"
              >
                Konfigurasi MongoDB & ImageKit
              </h2>
              <button
                type="button"
                onClick={() => setMongoInfoOpen(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded"
                aria-label="Tutup informasi database"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="space-y-1">
                <p>
                  Database:{" "}
                  <strong className="text-slate-900">
                    {storageMode === "mongodb"
                      ? "Terhubung ke MongoDB"
                      : "Penyimpanan Lokal Sementara (MONGODB_URI belum diisi)"}
                  </strong>
                </p>
                <p>
                  Penyimpanan Gambar Nota:{" "}
                  <strong className="text-slate-900">
                    {isImagekitReady
                      ? "ImageKit Aktif (hanya URL disimpan di MongoDB)"
                      : "ImageKit belum diatur (IMAGEKIT_PRIVATE_KEY kosong)"}
                  </strong>
                </p>
              </div>
              <p>
                Untuk deploy ke Vercel dengan MongoDB Atlas dan ImageKit, tambahkan environment variables berikut:
              </p>
              <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-3 rounded-lg space-y-1 overflow-x-auto">
                <div>MONGODB_URI=mongodb+srv://...</div>
                <div>MONGODB_DB_NAME=kasku_finance</div>
                <div>IMAGEKIT_PRIVATE_KEY=private_...</div>
                <div>IMAGEKIT_FOLDER=/kasku-notas</div>
                <div>GEMINI_API_KEY=...</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
