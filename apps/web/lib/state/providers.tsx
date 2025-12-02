"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { browserAdapter, DAWProvider } from "@wav0/daw-react";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { jotaiStore as store } from "./jotai-store";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
			},
		},
	});
}

function getQueryClient() {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}

	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}
	return browserQueryClient;
}

/**
 * DAW Initialization - Non-blocking background init
 * useEffect guarantees client-only execution (no SSR/prerender)
 * Audio service is now handled by SDK AudioEngine via DAWProvider
 */
function DAWInitializer({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

export function BaseProviders({ children }: { children: ReactNode }) {
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<JotaiProvider store={store}>
					<DAWProvider storageAdapter={browserAdapter}>
						<DAWInitializer>
							<NextTopLoader
								color="hsl(var(--primary))"
								showSpinner={false}
								height={2}
							/>
							<Toaster />
							{children}
						</DAWInitializer>
					</DAWProvider>
				</JotaiProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
