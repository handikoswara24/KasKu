export type TransactionType = "income" | "expense";

export const INCOME_CATEGORIES = [
  "Gaji",
  "Bonus",
  "Freelance",
  "Bisnis",
  "Investasi",
  "Hadiah",
  "Pengembalian Dana",
  "Lainnya",
] as const;

export const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Belanja Harian",
  "Transportasi",
  "Tagihan & Utilitas",
  "Kesehatan",
  "Belanja & Pribadi",
  "Hiburan",
  "Pendidikan",
  "Rumah Tangga",
  "Lainnya",
] as const;

export const ITEM_TYPE_SUGGESTIONS = [
  "Makanan & Minuman",
  "Bahan Pokok",
  "Kebutuhan Rumah Tangga",
  "Perawatan Pribadi",
  "Kesehatan & Obat",
  "Transportasi & BBM",
  "Elektronik & Gadget",
  "Pakaian & Aksesoris",
  "Hiburan & Gaya Hidup",
  "Pendidikan & Alat Tulis",
  "Tagihan & Utilitas",
  "Lainnya",
] as const;

export const PAYMENT_METHODS = [
  "QRIS",
  "Transfer Bank",
  "Tunai",
  "Kartu Debit",
  "Kartu Kredit",
  "E-Wallet",
  "Lainnya",
] as const;

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  suggestedType: string;
  typeReason?: string;
}

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  title: string;
  merchantName?: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  items?: ReceiptItem[];
  receiptPreviewUrl?: string;
  receiptFileId?: string;
  taxOrService?: number;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  title: string;
  merchantName?: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string;
  items?: ReceiptItem[];
  receiptPreviewUrl?: string;
  receiptFileId?: string;
  taxOrService?: number;
  discount?: number;
}

export interface ReceiptScanResult {
  merchantName: string;
  date: string;
  currency: string;
  items: ReceiptItem[];
  taxOrService: number;
  discount: number;
  totalAmount: number;
  suggestedCategory: string;
  paymentMethod: string;
  notes: string;
}

export interface MonthlyAggregate {
  monthKey: string; // YYYY-MM
  label: string;
  shortLabel: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface CategoryAggregate {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export type StorageMode = "mongodb" | "local-fallback";
