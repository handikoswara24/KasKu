const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}Rp ${Math.round(abs)}`;
}

export function formatDateID(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MONTHS_SHORT_ID[monthIdx] ?? match[2];
  return `${day} ${monthName} ${year}`;
}

export function formatMonthLabel(monthKey: string, short = false): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const names = short ? MONTHS_SHORT_ID : MONTHS_ID;
  const name = names[monthIdx] ?? match[2];
  return short ? `${name} '${year.slice(2)}` : `${name} ${year}`;
}

export function getTodayDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey(): string {
  return getTodayDateISO().slice(0, 7);
}

export function getRecentMonthKeys(count = 6, anchorMonthKey?: string): string[] {
  const anchor = anchorMonthKey && /^\d{4}-\d{2}$/.test(anchorMonthKey)
    ? anchorMonthKey
    : getCurrentMonthKey();
  const [yStr, mStr] = anchor.split("-");
  const anchorYear = Number(yStr);
  const anchorMonth = Number(mStr) - 1;

  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(anchorYear, anchorMonth - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}
