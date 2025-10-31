/**
 * Storage adapter interface for pluggable persistence
 * Supports sync and async adapters (localStorage, Convex, IndexedDB, OPFS)
 */

export interface StorageAdapter {
	getItem(key: string): string | null | Promise<string | null>;
	setItem(key: string, value: string): void | Promise<void>;
	removeItem(key: string): void | Promise<void>;
}

/**
 * In-memory storage adapter (for testing)
 */
export const memoryAdapter = (): StorageAdapter => {
	const store = new Map<string, string>();
	return {
		getItem: (key) => store.get(key) ?? null,
		setItem: (key, value) => {
			store.set(key, value);
		},
		removeItem: (key) => {
			store.delete(key);
		},
	};
};

/**
 * Browser localStorage adapter (default)
 */
export const browserAdapter: StorageAdapter = {
	getItem: (key) => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(key);
	},
	setItem: (key, value) => {
		if (typeof window === "undefined") return;
		localStorage.setItem(key, value);
	},
	removeItem: (key) => {
		if (typeof window === "undefined") return;
		localStorage.removeItem(key);
	},
};

// Global adapter instance
let currentAdapter: StorageAdapter = browserAdapter;

/**
 * Set the global storage adapter
 */
export function setStorageAdapter(adapter: StorageAdapter): void {
	currentAdapter = adapter;
}

/**
 * Get the current storage adapter
 */
export function getStorageAdapter(): StorageAdapter {
	return currentAdapter;
}
