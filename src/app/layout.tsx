import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sperton Recruitment Portal",
  description: "Modern candidate management and recruitment portal. Powered by AI-driven analysis.",
  keywords: ["Sperton", "Recruitment", "ATS", "Candidate Management", "AI Recruitment"],
  authors: [{ name: "Sperton Team" }],
  icons: {
    icon: "/portal/favicon.svg",
  },
  openGraph: {
    title: "Sperton Recruitment Portal",
    description: "Streamlined candidate management for modern recruitment.",
    siteName: "Sperton",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
