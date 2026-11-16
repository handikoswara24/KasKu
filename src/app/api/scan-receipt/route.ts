import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { getTodayDateISO } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  ITEM_TYPE_SUGGESTIONS,
  PAYMENT_METHODS,
  ReceiptScanResult,
} from "@/types/finance";

export const dynamic = "force-dynamic";

interface RawGeminiItem {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  suggestedType?: string;
  typeReason?: string;
}

interface RawGeminiReceipt {
  merchantName?: string;
  date?: string;
  currency?: string;
  items?: RawGeminiItem[];
  taxOrService?: number;
  discount?: number;
  totalAmount?: number;
  suggestedCategory?: string;
  paymentMethod?: string;
  notes?: string;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  return {
    mimeType: match[1],
    base64Data: match[2],
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY belum tersedia di server. Silakan atur GEMINI_API_KEY pada Secrets / Environment Variables.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { imageDataUrl?: string };
    if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
      return NextResponse.json(
        { error: "Gambar nota wajib dikirim dalam format data URL." },
        { status: 400 }
      );
    }

    const parsedImage = parseDataUrl(body.imageDataUrl);
    if (!parsedImage) {
      return NextResponse.json(
        { error: "Format gambar tidak didukung. Gunakan PNG, JPEG, atau WebP." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const today = getTodayDateISO();
    const promptText = `Analisis foto nota/struk belanja ini secara teliti dalam Bahasa Indonesia.
Tugas Anda:
1. Ekstrak nama toko/merchant (merchantName) dan tanggal transaksi dalam format YYYY-MM-DD (jika tanggal tidak terlihat jelas di struk, gunakan "${today}").
2. Ekstrak seluruh barang/item yang dibeli ke dalam array items:
   - name: nama barang yang jelas dan rapi
   - quantity: jumlah unit (angka, default 1 jika tidak tertulis)
   - unitPrice: harga satuan dalam angka (tanpa simbol mata uang, tanpa pemisah ribuan)
   - totalPrice: total harga untuk baris barang tersebut
   - suggestedType: pilih saran tipe barang yang paling tepat dari daftar berikut: ${ITEM_TYPE_SUGGESTIONS.join(", ")}
   - typeReason: alasan singkat (3-6 kata) mengapa tipe tersebut disarankan
3. Ekstrak pajak/PPN/biaya layanan (taxOrService), diskon/potongan (discount), dan total akhir pengeluaran (totalAmount).
4. Berikan suggestedCategory untuk transaksi keseluruhan dari daftar: ${EXPENSE_CATEGORIES.join(", ")}.
5. Deteksi paymentMethod jika terlihat pada nota dari daftar: ${PAYMENT_METHODS.join(", ")}.
6. Buat ringkasan 1 kalimat singkat di field notes.

Pastikan semua nilai numerik dalam Rupiah penuh (angka bulat positif). Jika angka pada struk memakai titik atau koma pemisah ribuan Indonesia (misal 25.000), konversi menjadi 25000.`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: parsedImage.mimeType,
              data: parsedImage.base64Data,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantName: { type: Type.STRING },
            date: { type: Type.STRING },
            currency: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  suggestedType: { type: Type.STRING },
                  typeReason: { type: Type.STRING },
                },
                required: ["name", "quantity", "unitPrice", "totalPrice", "suggestedType"],
              },
            },
            taxOrService: { type: Type.NUMBER },
            discount: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            suggestedCategory: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["merchantName", "date", "items", "totalAmount", "suggestedCategory"],
        },
      },
    });

    const rawText = (response.text ?? "{}").trim();
    const parsed = JSON.parse(rawText) as RawGeminiReceipt;

    const items = (parsed.items ?? []).map((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const total = Math.max(0, Math.round(Number(item.totalPrice) || 0));
      const unit =
        Number(item.unitPrice) > 0
          ? Math.round(Number(item.unitPrice))
          : Math.round(total / qty);

      return {
        id: crypto.randomUUID(),
        name: (item.name ?? "Barang Tanpa Nama").trim(),
        quantity: qty,
        unitPrice: unit,
        totalPrice: total > 0 ? total : unit * qty,
        suggestedType: item.suggestedType?.trim() || "Lainnya",
        typeReason: item.typeReason?.trim() || undefined,
      };
    });

    const itemsSum = items.reduce((acc, item) => acc + item.totalPrice, 0);
    const taxOrService = Math.max(0, Math.round(Number(parsed.taxOrService) || 0));
    const discount = Math.max(0, Math.round(Number(parsed.discount) || 0));
    const parsedTotal = Math.max(0, Math.round(Number(parsed.totalAmount) || 0));
    const computedTotal =
      parsedTotal > 0 ? parsedTotal : Math.max(0, itemsSum + taxOrService - discount);

    const validDate =
      parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;

    const result: ReceiptScanResult = {
      merchantName: parsed.merchantName?.trim() || "Toko / Merchant",
      date: validDate,
      currency: parsed.currency?.trim() || "IDR",
      items,
      taxOrService,
      discount,
      totalAmount: computedTotal,
      suggestedCategory: parsed.suggestedCategory?.trim() || "Belanja Harian",
      paymentMethod: parsed.paymentMethod?.trim() || "QRIS",
      notes: parsed.notes?.trim() || "Transaksi dari pemindaian foto nota.",
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memindai nota.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
