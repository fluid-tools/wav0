import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
	metadataBase: new URL("https://wav0.app"),
	applicationName: "WAV0",
	title: "WAV0 AI — Idea to Sound in Seconds",
	description:
		"Go from idea to sound in seconds. AI-Native Music Studio with the fastest AI producer, songwriter, and sound designer right in your pocket. Create reference tracks, soundpacks, samples, and beats.",
	keywords: [
		"AI music generation",
		"idea to sound",
		"music production",
		"AI producer",
		"soundpacks",
		"beats",
		"samples",
		"AI-Native",
		"music studio",
		"browser-based",
		"web app",
		"WAV0 AI",
		"WAV0",
	],
	alternates: {
		canonical: "https://wav0.app",
	},
	openGraph: {
		title: "WAV0 AI — Idea to Sound in Seconds",
		description:
			"Go from idea to sound in seconds. AI-Native Music Studio with the fastest AI producer, songwriter, and sound designer right in your pocket. Create reference tracks, soundpacks, samples, and beats.",
		url: "https://wav0.app",
		siteName: "WAV0",
		images: [
			{
				url: "/og.png",
				width: 1200,
				height: 630,
				alt: "WAV0 AI — Idea to Sound in Seconds, the fastest producer in your pocket",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		site: "@wav0ai",
		creator: "@wav0ai",
		title: "WAV0 AI — Idea to Sound in Seconds",
		description:
			"Go from idea to sound in seconds. AI-Native Music Studio with the fastest AI producer, songwriter, and sound designer right in your pocket. Create reference tracks, soundpacks, samples, and beats.",
		images: ["/og.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			{/* <head>
				{process.env.NODE_ENV === "development" && (
					<Script
						src="//unpkg.com/react-grab/dist/index.global.js"
						crossOrigin="anonymous"
						strategy="beforeInteractive"
						data-enabled="true"
					/>
				)}
			</head> */}
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<BaseProviders>{children}</BaseProviders>
			</body>
		</html>
	);
}
