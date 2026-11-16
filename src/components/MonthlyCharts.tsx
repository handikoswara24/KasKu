"use client";

import { useMemo, useState } from "react";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { CategoryAggregate, MonthlyAggregate } from "@/types/finance";

interface MonthlyChartsProps {
  monthlyData: MonthlyAggregate[];
  categoryData: CategoryAggregate[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  totalExpense: number;
}

export function MonthlyCharts({
  monthlyData,
  categoryData,
  selectedMonth,
  onSelectMonth,
  totalExpense,
}: MonthlyChartsProps) {
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  const maxChartValue = useMemo(() => {
    const peak = monthlyData.reduce(
      (max, m) => Math.max(max, m.income, m.expense),
      0
    );
    return peak > 0 ? peak * 1.15 : 1_000_000;
  }, [monthlyData]);

  const activeHoverItem = useMemo(() => {
    const key = hoveredMonthKey ?? (selectedMonth !== "all" ? selectedMonth : null);
    return monthlyData.find((m) => m.monthKey === key) ?? null;
  }, [hoveredMonthKey, monthlyData, selectedMonth]);

  const yTicks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <section
      aria-label="Grafik Ringkasan Bulanan"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6"
    >
      {/* Monthly Income vs Expense Grouped Bar Chart */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Grafik Arus Kas Bulanan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pemasukan dan pengeluaran 6 bulan terakhir. Ketuk bulan untuk memfilter.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"
                aria-hidden="true"
              />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block"
                aria-hidden="true"
              />
              Pengeluaran
            </span>
          </div>
        </div>

        {/* Live Detail Strip on Hover / Tap */}
        <div className="py-3 px-3.5 mt-4 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-h-[52px]">
          {activeHoverItem ? (
            <>
              <div className="text-xs font-medium text-slate-700">
                {activeHoverItem.label}
                <span className="text-slate-400 mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-500 font-normal">
                  {activeHoverItem.count} transaksi
                </span>
              </div>
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-5 text-[11px] sm:text-xs font-mono tabular-nums">
                <span className="text-emerald-700 truncate">
                  +{formatCompactIDR(activeHoverItem.income)}
                </span>
                <span className="text-rose-700 truncate">
                  -{formatCompactIDR(activeHoverItem.expense)}
                </span>
                <span
                  className={`truncate font-semibold ${
                    activeHoverItem.net >= 0 ? "text-teal-700" : "text-rose-700"
                  }`}
                >
                  {activeHoverItem.net >= 0 ? "+" : ""}
                  {formatCompactIDR(activeHoverItem.net)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-500">
              Ketuk batang grafik untuk melihat rincian nominal per bulan.
            </span>
          )}
        </div>

        {/* Responsive SVG-like CSS Bar Chart Canvas (no horizontal overflow on mobile) */}
        <div className="mt-5 w-full">
          <div className="relative h-52 sm:h-60 flex">
            {/* Y-Axis Labels */}
            <div className="w-14 sm:w-[72px] shrink-0 flex flex-col justify-between pr-2 sm:pr-3 pb-7 text-right font-mono text-[10px] sm:text-[11px] text-slate-400 tabular-nums">
              {yTicks.map((ratio) => (
                <span key={ratio} className="truncate">
                  {ratio === 0 ? "0" : formatCompactIDR(maxChartValue * ratio)}
                </span>
              ))}
            </div>

            {/* Plot Area */}
            <div className="flex-1 min-w-0 relative flex flex-col">
              {/* Horizontal Gridlines */}
              <div className="flex-1 relative border-b border-slate-200">
                {yTicks.slice(0, -1).map((ratio) => (
                  <div
                    key={ratio}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-200/80"
                    style={{ top: `${(1 - ratio) * 100}%` }}
                  />
                ))}

                {/* Bar Groups */}
                <div className="absolute inset-0 grid grid-cols-6 gap-1 sm:gap-3 px-1 sm:px-2 items-end">
                  {monthlyData.map((month) => {
                    const incomeHeight = Math.max(
                      month.income > 0 ? 4 : 0,
                      (month.income / maxChartValue) * 100
                    );
                    const expenseHeight = Math.max(
                      month.expense > 0 ? 4 : 0,
                      (month.expense / maxChartValue) * 100
                    );
                    const isSelected = selectedMonth === month.monthKey;
                    const isHovered = hoveredMonthKey === month.monthKey;

                    return (
                      <button
                        key={month.monthKey}
                        type="button"
                        onMouseEnter={() => setHoveredMonthKey(month.monthKey)}
                        onMouseLeave={() => setHoveredMonthKey(null)}
                        onFocus={() => setHoveredMonthKey(month.monthKey)}
                        onBlur={() => setHoveredMonthKey(null)}
                        onClick={() =>
                          onSelectMonth(
                            selectedMonth === month.monthKey
                              ? "all"
                              : month.monthKey
                          )
                        }
                        aria-label={`${month.label}: Pemasukan ${formatIDR(
                          month.income
                        )}, Pengeluaran ${formatIDR(month.expense)}`}
                        className={`group h-full flex items-end justify-center gap-0.5 sm:gap-1.5 px-0.5 sm:px-1.5 rounded-t-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                          isSelected
                            ? "bg-teal-50/80"
                            : isHovered
                            ? "bg-slate-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-2.5 sm:w-4 md:w-5 h-full flex items-end">
                          <div
                            className="w-full rounded-t bg-emerald-600 group-hover:bg-emerald-700 transition-all duration-200"
                            style={{ height: `${incomeHeight}%` }}
                          />
                        </div>
                        <div className="w-2.5 sm:w-4 md:w-5 h-full flex items-end">
                          <div
                            className="w-full rounded-t bg-rose-600 group-hover:bg-rose-700 transition-all duration-200"
                            style={{ height: `${expenseHeight}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* X-Axis Month Labels */}
              <div className="h-7 grid grid-cols-6 gap-1 sm:gap-3 px-1 sm:px-2 items-center">
                {monthlyData.map((month) => {
                  const isSelected = selectedMonth === month.monthKey;
                  return (
                    <span
                      key={month.monthKey}
                      className={`text-center text-[10px] sm:text-xs truncate ${
                        isSelected
                          ? "font-semibold text-teal-700"
                          : "text-slate-500"
                      }`}
                    >
                      {month.shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Category Breakdown */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Pengeluaran per Kategori
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Total periode terpilih:{" "}
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              {formatIDR(totalExpense)}
            </span>
          </p>
        </div>

        {categoryData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              Belum ada pengeluaran tercatat
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Pindai nota belanja atau catat pengeluaran manual untuk melihat komposisi kategori.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {categoryData.slice(0, 6).map((cat) => (
              <div key={cat.category} className="py-3 first:pt-1 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800 truncate">
                    {cat.category}
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 font-semibold shrink-0">
                    {formatIDR(cat.amount)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 w-11 text-right shrink-0">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
