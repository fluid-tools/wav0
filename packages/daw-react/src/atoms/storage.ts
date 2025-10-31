/**
 * Atom with storage wrapper
 * Integrates Jotai atoms with pluggable storage adapters
 */

"use client";

import { atom, type WritableAtom } from "jotai";
import { getStorageAdapter } from "../storage/adapter";

export function atomWithStorage<T>(
	key: string,
	initialValue: T,
): WritableAtom<T, [T], void> {
	const baseAtom = atom(initialValue);

	// Load initial value from storage on mount
	// onMount can't be async, but we ensure load completes before allowing reads
	baseAtom.onMount = (setAtom) => {
		const adapter = getStorageAdapter();
		const loadValue = async () => {
			try {
				const stored = await adapter.getItem(key);

				if (stored !== null) {
					const parsed = JSON.parse(stored);
					setAtom(parsed);
				}
			} catch (e) {
				console.warn(`Failed to load stored value for ${key}:`, e);
			}
		};

		// Execute load immediately - consumers should check if atom is mounted
		loadValue().catch((err) => {
			console.error(`Failed to load ${key} from storage:`, err);
		});
	};

	// Create derived atom that syncs to storage
	const derivedAtom = atom(
		(get) => get(baseAtom),
		(get, set, update: T) => {
			set(baseAtom, update);

			// Persist to storage (fire and forget for async)
			const adapter = getStorageAdapter();
			const saveValue = async () => {
				await adapter.setItem(key, JSON.stringify(update));
			};
			saveValue().catch((err) => {
				console.error(`Failed to save ${key} to storage`, err);
			});
		},
	);

	return derivedAtom as WritableAtom<T, [T], void>;
}
