import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Cricket Live — Score every ball",
  description: "Score every ball. Share the chase.",
};

export const viewport: Viewport = {
  themeColor: "#F8F9FA",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} style={{ ["--font-primary" as string]: "var(--font-inter)" }}>
      <body className="min-h-dvh bg-[var(--background)] text-[var(--text-primary)] antialiased font-primary">
        <div className="mx-auto w-full max-w-md min-h-dvh flex flex-col relative">
          {children}
        </div>
      </body>
    </html>
  );
}
