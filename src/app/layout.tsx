import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Signal Room // Incident-Triage Copilot — Mozilla Otari 'Devs Wilding Online'",
  description:
    "Dual open-weight LLM incident-triage war room powered by Mozilla Otari / any-llm gateway (llama-3.3-70b-instruct + qwen3-coder-30b-a3b-instruct) with deterministic mock mode.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="bg-[#090B0E] text-[#F1F5F9] font-sans antialiased selection:bg-[#FF6B2B]/30 selection:text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
