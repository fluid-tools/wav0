import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BaseProviders } from "@/lib/state/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://wav0.app'),
  applicationName: 'WAVFLIP',
  title: 'WAV0 — AI-Native Music Studio',
  description:
    'AI-Native Music Studio. Prompt to sound, agent-powered editing, and Vault storage.',
  keywords: [
    'AI audio sampler',
    'prompt to sound',
    'multi-track',
    'cursor',
    'sampling',
    'AI-Native',
    'stems',
    'music production',
    'browser-based',
    'web app',
    'WAV0',
  ],
  alternates: {
    canonical: 'https://wav0.app',
  },
  openGraph: {
    title: 'WAV0 — AI-Native Music Studio',
    description:
      'AI-Assist for music production in your browser. Prompt to sound, generate and edit stems, multi-track arranging, and exporting or saving to your Vault.',
    url: 'https://wav0.app',
    siteName: 'WAV0',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'WAV0 — AI-Native Music Studio',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WAV0 — AI-Native Music Studio',
    description:
      'AI-Native Music Studio. Prompt to sound, agent-powered editing, and Vault storage.',
    images: ['/og.png'],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BaseProviders>{children}</BaseProviders>
      </body>
    </html>
  );
}
