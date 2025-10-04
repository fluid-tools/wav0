"use client";

import {
	isServer,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { Analytics } from "@vercel/analytics/next";
import { del, get, set } from "idb-keyval";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";
import type { ReactNode } from "react";
import TopLoader from "@/components/nav/toploader";
import { Toaster } from "@/components/ui/sonner";
import { jotaiStore } from "@/lib/state/jotai-store";

function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 5 * 60 * 1000, // 5 minutes
				gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
				refetchOnWindowFocus: false,
				retry: 1,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (isServer) {
		// Server: always make a new query client
		return makeQueryClient();
	}
	// Browser: make a new query client if we don't already have one
	// This is very important, so we don't re-make a new client if React
	// suspends during the initial render. This may not be needed if we
	// have a suspense boundary BELOW the creation of the query client
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();

		// Only setup persistence on the client side
		if (typeof window !== "undefined") {
			// Create a custom persister using IndexedDB via idb-keyval
			const idbPersister: Persister = {
				persistClient: async (persistedClient: PersistedClient) => {
					await set("wavflip-cache", persistedClient);
				},
				restoreClient: async () => {
					return await get("wavflip-cache");
				},
				removeClient: async () => {
					await del("wavflip-cache");
				},
			};

			// Setup query persistence
			persistQueryClient({
				queryClient: browserQueryClient,
				persister: idbPersister,
				maxAge: 24 * 60 * 60 * 1000, // 24 hours
				buster: process.env.NEXT_PUBLIC_VERSION || "1.0.0", // Cache buster
			});
		}
	}
	return browserQueryClient;
}

export function BaseProviders({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			<TopLoader />
			<JotaiProvider store={jotaiStore}>
				{children}
				<Toaster
					className="z-[999999]"
					position="top-right"
					toastOptions={{
						style: {
							background: "#000",
							color: "#fff",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							fontWeight: "200",
							letterSpacing: "0.02em",
							borderRadius: "12px",
						},
					}}
				/>
			</JotaiProvider>
			<Analytics />
		</ThemeProvider>
	);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
	// NOTE: Avoid useState when initializing the query client if you don't
	//       have a suspense boundary between this and the code that may
	//       suspend because React will throw away the client on the initial
	//       render if it suspends and there is no boundary
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{process.env.NODE_ENV !== "production" && <ReactQueryDevtools />}
		</QueryClientProvider>
	);
}

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<BaseProviders>
			<QueryProvider>{children}</QueryProvider>
		</BaseProviders>
	);
}
