/**
 * DAW Provider - App-wide SDK access via React Context
 */

"use client";

import type { DAW, DAWConfig } from "@wav0/daw-sdk";
import { Provider as JotaiProvider } from "jotai";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useDAW } from "../hooks/use-daw";
import { type StorageAdapter, setStorageAdapter } from "../storage/adapter";

const DAWContext = createContext<DAW | null>(null);

export interface DAWProviderProps {
	children: ReactNode;
	config?: DAWConfig;
	storageAdapter?: StorageAdapter;
}

export function DAWProvider({
	children,
	config,
	storageAdapter,
}: DAWProviderProps) {
	const daw = useDAW(config);

	// Set storage adapter if provided
	useEffect(() => {
		if (storageAdapter) {
			setStorageAdapter(storageAdapter);
		}
	}, [storageAdapter]);

	if (!daw) return null;

	return (
		<DAWContext.Provider value={daw}>
			<JotaiProvider>{children}</JotaiProvider>
		</DAWContext.Provider>
	);
}

export function useDAWContext(): DAW {
	const daw = useContext(DAWContext);
	if (!daw) {
		throw new Error("useDAWContext must be used within DAWProvider");
	}
	return daw;
}
