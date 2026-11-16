import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateID, formatIDR, formatMonthLabel } from "@/lib/format";
import { CategoryAggregate, TransactionRecord } from "@/types/finance";

interface ExportPdfOptions {
  transactions: TransactionRecord[];
  periodLabel: string;
  selectedMonth: string; // YYYY-MM or "all"
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  categoryBreakdown: CategoryAggregate[];
}

export function exportFinanceReportPDF(options: ExportPdfOptions): {
  fileName: string;
  blobUrl: string;
} {
  const {
    transactions,
    periodLabel,
    selectedMonth,
    totalIncome,
    totalExpense,
    netBalance,
    categoryBreakdown,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header band
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Laporan Keuangan Pribadi — KasKu", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  const printedAt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  doc.text(`Periode: ${periodLabel}   |   Dicetak: ${printedAt}`, margin, 23);

  // Summary KPI Row
  const boxY = 39;
  const boxW = (pageWidth - margin * 2 - 8) / 3;
  const boxH = 21;

  const kpis = [
    {
      label: "Total Pemasukan",
      value: formatIDR(totalIncome),
      accent: [21, 128, 61] as [number, number, number],
    },
    {
      label: "Total Pengeluaran",
      value: formatIDR(totalExpense),
      accent: [190, 18, 60] as [number, number, number],
    },
    {
      label: "Saldo Bersih",
      value: formatIDR(netBalance),
      accent: netBalance >= 0 ? ([15, 118, 110] as [number, number, number]) : ([190, 18, 60] as [number, number, number]),
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (boxW + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 4, boxY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(kpi.accent[0], kpi.accent[1], kpi.accent[2]);
    doc.text(kpi.value, x + 4, boxY + 15.5);
  });

  let nextY = boxY + boxH + 10;

  // Category Breakdown Table (if any expense categories exist)
  if (categoryBreakdown.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Ringkasan Pengeluaran per Kategori", margin, nextY);

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: margin, right: margin },
      head: [["Kategori", "Transaksi", "Porsi", "Total Pengeluaran"]],
      body: categoryBreakdown.map((cat) => [
        cat.category,
        `${cat.count}x`,
        `${cat.percentage.toFixed(1)}%`,
        formatIDR(cat.amount),
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: 2.8,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    const tableMeta = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    nextY = (tableMeta?.finalY ?? nextY + 30) + 10;
  }

  // Ledger Transactions Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rincian Transaksi (${transactions.length} entri)`, margin, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    margin: { left: margin, right: margin },
    head: [["Tanggal", "Keterangan / Rincian Nota", "Kategori", "Tipe", "Nominal"]],
    body: transactions.map((tx) => {
      const itemsText =
        tx.items && tx.items.length > 0
          ? `\nItem Nota: ${tx.items
              .map(
                (i) =>
                  `${i.name} (${i.quantity}x · ${i.suggestedType} · ${formatIDR(i.totalPrice)})`
              )
              .join("; ")}`
          : "";
      const merchantPrefix =
        tx.merchantName && tx.merchantName !== tx.title
          ? `${tx.merchantName} — ${tx.title}`
          : tx.title;
      const platformTag = tx.sourcePlatform
        ? `[${tx.sourcePlatform}${tx.serviceLabel ? ` · ${tx.serviceLabel}` : ""}] `
        : "";
      const actorTag = tx.username ? `\nOleh: ${tx.username}` : "";

      return [
        formatDateID(tx.date),
        `${platformTag}${merchantPrefix}${actorTag}${itemsText}`,
        `${tx.category}\n${tx.paymentMethod}`,
        tx.type === "income" ? "Pemasukan" : "Pengeluaran",
        `${tx.type === "income" ? "+" : "-"} ${formatIDR(tx.amount)}`,
      ];
    }),
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      valign: "top",
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 34 },
      3: { cellWidth: 23, halign: "center" },
      4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const raw = String(data.cell.raw ?? "");
        if (raw.startsWith("+")) {
          data.cell.styles.textColor = [21, 128, 61];
        } else if (raw.startsWith("-")) {
          data.cell.styles.textColor = [190, 18, 60];
        }
      }
    },
  });

  // Page footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `KasKu Keuangan Pribadi · ${periodLabel}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
  }

  const fileSlug =
    selectedMonth === "all"
      ? "Semua-Periode"
      : formatMonthLabel(selectedMonth).replace(/\s+/g, "-");
  const fileName = `Laporan-Keuangan-${fileSlug}.pdf`;
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { fileName, blobUrl };
}
