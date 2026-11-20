import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { getTodayDateISO } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  ITEM_TYPE_SUGGESTIONS,
  PAYMENT_METHODS,
  ReceiptScanResult,
  SOURCE_PLATFORMS,
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
  sourcePlatform?: string;
  serviceLabel?: string;
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
    const promptText = `Analisis gambar nota fisik ATAU tangkapan layar (screenshot) transaksi digital dari Gojek, Grab, atau E-Commerce Indonesia (Shopee, Tokopedia, TikTok Shop, Lazada, Blibli, Bukalapak, Zalora, Astro, dll.) secara sangat teliti dalam Bahasa Indonesia.

Tugas Anda:
1. Identifikasi platform sumber transaksi (sourcePlatform) dari daftar: ${SOURCE_PLATFORMS.join(", ")}.
   - Jika screenshot berasal dari aplikasi Gojek (GoFood, GoRide, GoCar, GoSend, GoMart, GoTagihan), pilih "Gojek".
   - Jika screenshot berasal dari aplikasi Grab (GrabFood, GrabBike, GrabCar, GrabExpress, GrabMart), pilih "Grab".
   - Jika dari aplikasi belanja online, pilih nama e-commerce yang sesuai ("Shopee", "Tokopedia", "TikTok Shop", "Lazada", "Blibli", atau "Lainnya").
   - Jika struk kertas kasir/toko fisik biasa, pilih "Struk Toko".
2. Identifikasi jenis layanan (serviceLabel) secara singkat, misalnya: "GoFood", "GoCar", "GoRide", "GoSend", "GrabFood", "GrabCar", "GrabBike", "Pesanan Shopee", "Pesanan Tokopedia", atau "Struk Kasir".
3. Ekstrak merchantName:
   - Untuk makanan/toko/e-commerce: nama restoran, merchant, atau nama toko penjual.
   - Untuk transportasi (GoRide/GoCar/GrabBike/GrabCar) atau kurir (GoSend/GrabExpress): tulis layanan & rute singkatnya, misalnya "GoCar · Gambir → Sudirman".
4. Ekstrak tanggal transaksi ke format YYYY-MM-DD (konversi format tanggal Indonesia seperti "15 Nov 2026" atau "22 Jun 2024" menjadi YYYY-MM-DD; jika benar-benar tidak ada tanggal di gambar, gunakan "${today}").
5. Ekstrak seluruh item/barang/layanan yang dibeli ke dalam array items:
   - Untuk GoFood/GrabFood/E-Commerce/Struk Toko: masukkan tiap menu atau produk yang dibeli (abaikan harga coret, ambil harga yang dibayar), dengan quantity (boleh desimal seperti 0.5 atau 1.25 untuk barang timbangan/kg/liter), unitPrice, totalPrice.
   - Untuk perjalanan GoRide/GoCar/GrabBike/GrabCar atau pengiriman GoSend/GrabExpress: masukkan tarif perjalanan/pengiriman sebagai item dengan suggestedType "Transportasi & BBM" atau "Biaya Pengiriman & Kurir".
   - Untuk setiap item, wajib pilih suggestedType dari daftar: ${ITEM_TYPE_SUGGESTIONS.join(", ")}, serta typeReason singkat (3-6 kata).
6. taxOrService: gabungkan biaya ongkos kirim, biaya aplikasi, biaya jasa platform, biaya layanan, asuransi pengiriman, atau pajak PB1/PPN yang terpisah dari harga barang (0 jika tidak ada).
7. discount: gabungkan seluruh potongan harga, promo, voucher toko, voucher gratis ongkir, atau penukaran koin yang mengurangi total bayar (0 jika tidak ada).
8. totalAmount: total akhir pengeluaran yang benar-benar dibayar oleh pengguna ("Total Bayar", "Total Pembayaran", "Total Pesanan", atau "Total").
9. suggestedCategory: pilih kategori utama pengeluaran dari daftar: ${EXPENSE_CATEGORIES.join(", ")}. (Gunakan "Transportasi" untuk GoRide/GoCar/GrabBike/GrabCar; "Makanan & Minuman" untuk GoFood/GrabFood/restoran; "Belanja Online" untuk pembelian produk e-commerce jika beragam).
10. paymentMethod: deteksi metode pembayaran dari daftar: ${PAYMENT_METHODS.join(", ")} (misal GoPay, OVO, ShopeePay, QRIS, Transfer Bank / VA, Kartu Debit, Kartu Kredit, Tunai).
11. notes: ringkasan 1 kalimat singkat tentang transaksi ini.

Pastikan seluruh harga dan nominal Rupiah adalah bilangan bulat penuh (hilangkan titik/koma pemisah ribuan seperti 25.000 menjadi 25000), sedangkan quantity boleh berupa bilangan desimal jika tertera di nota.`;

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
            sourcePlatform: { type: Type.STRING },
            serviceLabel: { type: Type.STRING },
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
          required: [
            "sourcePlatform",
            "merchantName",
            "date",
            "items",
            "totalAmount",
            "suggestedCategory",
          ],
        },
      },
    });

    const rawText = (response.text ?? "{}").trim();
    const parsed = JSON.parse(rawText) as RawGeminiReceipt;

    const items = (parsed.items ?? []).map((item) => {
      const parsedQty = Number(item.quantity);
      const qty =
        Number.isFinite(parsedQty) && parsedQty > 0
          ? Math.round(parsedQty * 1000) / 1000
          : 1;
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
        totalPrice: total > 0 ? total : Math.round(unit * qty),
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
      sourcePlatform: parsed.sourcePlatform?.trim() || "Struk Toko",
      serviceLabel: parsed.serviceLabel?.trim() || "",
      merchantName: parsed.merchantName?.trim() || "Toko / Merchant",
      date: validDate,
      currency: parsed.currency?.trim() || "IDR",
      items,
      taxOrService,
      discount,
      totalAmount: computedTotal,
      suggestedCategory: parsed.suggestedCategory?.trim() || "Belanja Harian",
      paymentMethod: parsed.paymentMethod?.trim() || "QRIS",
      notes: parsed.notes?.trim() || "Transaksi dari pemindaian nota.",
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
