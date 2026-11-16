import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KasKu — Catatan Keuangan & Pemindai Nota",
  description:
    "Aplikasi pencatatan pemasukan dan pengeluaran pribadi berbasis Next.js dan MongoDB dengan pemindai nota AI, grafik ringkasan bulanan, dan ekspor laporan PDF.",
  openGraph: {
    title: "KasKu — Catatan Keuangan & Pemindai Nota",
    description:
      "Aplikasi pencatatan pemasukan dan pengeluaran pribadi berbasis Next.js dan MongoDB dengan pemindai nota AI, grafik ringkasan bulanan, dan ekspor laporan PDF.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KasKu — Catatan Keuangan & Pemindai Nota",
    description:
      "Aplikasi pencatatan pemasukan dan pengeluaran pribadi berbasis Next.js dan MongoDB dengan pemindai nota AI, grafik ringkasan bulanan, dan ekspor laporan PDF.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
        {children}
      </body>
    </html>
  );
}
