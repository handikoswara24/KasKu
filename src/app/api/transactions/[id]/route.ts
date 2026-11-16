import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction, updateTransaction } from "@/lib/transactions-store";
import { CreateTransactionInput } from "@/types/finance";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<CreateTransactionInput>;
    const result = await updateTransaction(id, body);

    if (!result.transaction) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui transaksi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await deleteTransaction(id);

    if (!result.deleted) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus transaksi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
