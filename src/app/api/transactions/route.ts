import { NextRequest, NextResponse } from "next/server";
import {
  isImageKitConfigured,
  uploadReceiptToImageKit,
} from "@/lib/imagekit";
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
    return NextResponse.json(
      {
        ...result,
        imagekitConfigured: isImageKitConfigured(),
      },
      { status: 200 }
    );
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

    let receiptPreviewUrl: string | undefined;
    let receiptFileId: string | undefined;

    if (typeof body.receiptPreviewUrl === "string" && body.receiptPreviewUrl.trim()) {
      const rawUrl = body.receiptPreviewUrl.trim();
      if (rawUrl.startsWith("data:image/")) {
        if (!isImageKitConfigured()) {
          return NextResponse.json(
            {
              error:
                "IMAGEKIT_PRIVATE_KEY belum dikonfigurasi pada Secrets / Environment Variables. Gambar nota hanya disimpan ke ImageKit (tidak ke MongoDB).",
            },
            { status: 503 }
          );
        }
        const uploaded = await uploadReceiptToImageKit(
          rawUrl,
          body.merchantName || body.title
        );
        receiptPreviewUrl = uploaded.url;
        receiptFileId = uploaded.fileId;
      } else if (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) {
        receiptPreviewUrl = rawUrl;
        receiptFileId = body.receiptFileId?.trim() || undefined;
      }
    }

    const payload: CreateTransactionInput = {
      type: body.type,
      title: body.title.trim(),
      merchantName: body.merchantName?.trim(),
      sourcePlatform: body.sourcePlatform?.trim(),
      serviceLabel: body.serviceLabel?.trim(),
      category: body.category?.trim() || "Lainnya",
      amount: Math.round(numericAmount),
      date: body.date,
      paymentMethod: body.paymentMethod?.trim() || "Lainnya",
      notes: body.notes?.trim(),
      items: Array.isArray(body.items) ? body.items : undefined,
      receiptPreviewUrl,
      receiptFileId,
      taxOrService:
        body.taxOrService !== undefined ? Number(body.taxOrService) : undefined,
      discount: body.discount !== undefined ? Number(body.discount) : undefined,
    };

    const result = await createTransaction(payload);
    return NextResponse.json(
      {
        ...result,
        imagekitConfigured: isImageKitConfigured(),
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan transaksi ke database.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
