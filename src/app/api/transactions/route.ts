import { NextRequest, NextResponse } from "next/server";
import { createTransaction, listTransactions } from "@/lib/transactions-store";
import { CreateTransactionInput } from "@/types/finance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const result = await listTransactions({ month, type, search });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memuat daftar transaksi dari database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CreateTransactionInput>;

    if (body.type !== "income" && body.type !== "expense") {
      return NextResponse.json(
        { error: "Tipe transaksi harus 'income' atau 'expense'." },
        { status: 400 }
      );
    }

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "Judul atau keterangan transaksi wajib diisi." },
        { status: 400 }
      );
    }

    const numericAmount = Number(body.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Nominal transaksi harus lebih besar dari 0." },
        { status: 400 }
      );
    }

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        { error: "Format tanggal tidak valid (gunakan YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const payload: CreateTransactionInput = {
      type: body.type,
      title: body.title.trim(),
      merchantName: body.merchantName?.trim(),
      category: body.category?.trim() || "Lainnya",
      amount: Math.round(numericAmount),
      date: body.date,
      paymentMethod: body.paymentMethod?.trim() || "Lainnya",
      notes: body.notes?.trim(),
      items: Array.isArray(body.items) ? body.items : undefined,
      receiptPreviewUrl:
        typeof body.receiptPreviewUrl === "string" &&
        body.receiptPreviewUrl.startsWith("data:image/")
          ? body.receiptPreviewUrl
          : undefined,
      taxOrService:
        body.taxOrService !== undefined ? Number(body.taxOrService) : undefined,
      discount: body.discount !== undefined ? Number(body.discount) : undefined,
    };

    const result = await createTransaction(payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan transaksi ke database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
