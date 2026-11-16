import { FinanceWorkspace } from "@/components/FinanceWorkspace";
import { getCurrentMonthKey } from "@/lib/format";
import { isImageKitConfigured } from "@/lib/imagekit";
import { listTransactions } from "@/lib/transactions-store";
import { StorageMode, TransactionRecord } from "@/types/finance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initialTransactions: TransactionRecord[] = [];
  let initialStorageMode: StorageMode = "local-fallback";
  let initialError: string | null = null;
  const currentMonthKey = getCurrentMonthKey();
  const imagekitConfigured = isImageKitConfigured();

  try {
    const result = await listTransactions();
    initialTransactions = result.transactions;
    initialStorageMode = result.storageMode;
  } catch (err) {
    initialError =
      err instanceof Error
        ? err.message
        : "Gagal terhubung ke database saat memuat data awal.";
  }

  return (
    <FinanceWorkspace
      initialTransactions={initialTransactions}
      initialStorageMode={initialStorageMode}
      initialError={initialError}
      currentMonthKey={currentMonthKey}
      imagekitConfigured={imagekitConfigured}
    />
  );
}
