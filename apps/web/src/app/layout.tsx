import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Blessed Ave Cafe",
  description: "Great coffee, great food, great vibes.",
  openGraph: {
    title: "Blessed Ave Cafe",
    description: "Order online or scan your table's QR to order.",
    siteName: "Blessed Ave Cafe",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-[#0d0805] font-sans text-stone-800 antialiased">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
