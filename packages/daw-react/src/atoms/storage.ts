/**
 * Atom with storage wrapper
 * Integrates Jotai atoms with pluggable storage adapters
 *
 * Uses synchronous loading for sync adapters (like browserAdapter) to prevent
 * race conditions where initial values could overwrite stored data.
 */

"use client";

import { atom, type WritableAtom } from "jotai";
import { getStorageAdapter } from "../storage/adapter";

export function atomWithStorage<T>(
	key: string,
	initialValue: T,
): WritableAtom<T, [T | ((prev: T) => T)], void> {
	const baseAtom = atom(initialValue);

	// Load initial value from storage on mount
	// Try synchronous load first (for browserAdapter), fall back to async
	baseAtom.onMount = (setAtom) => {
		const adapter = getStorageAdapter();

		try {
			const stored = adapter.getItem(key);

			// Handle sync result (string | null)
			// Use explicit null check (not truthiness) to preserve empty strings
			if (
				stored !== null &&
				typeof stored === "string" &&
				stored !== "undefined"
			) {
				try {
					const parsed = JSON.parse(stored);
					setAtom(parsed);
				} catch (parseError) {
					console.warn(
						`Failed to parse stored value for ${key}, clearing corrupted data:`,
						parseError,
					);
					try {
						adapter.removeItem(key);
					} catch {
						// Ignore removal errors
					}
				}
				return; // Sync load succeeded
			}

			// Handle async result (Promise)
			if (stored instanceof Promise) {
				stored
					.then((value) => {
						// Use explicit null check (consistent with sync path)
						if (value !== null && value !== "undefined") {
							try {
								const parsed = JSON.parse(value);
								setAtom(parsed);
							} catch (parseError) {
								console.warn(
									`Failed to parse stored value for ${key}, clearing corrupted data:`,
									parseError,
								);
								const removeResult = adapter.removeItem(key);
								if (removeResult instanceof Promise) {
									removeResult.catch(() => {});
								}
							}
						}
					})
					.catch((err) => {
						console.error(`Failed to load ${key} from storage:`, err);
					});
			}
		} catch (e) {
			console.warn(`Failed to load stored value for ${key}:`, e);
		}
	};

	// Create derived atom that syncs to storage
	// Supports both direct values and function updaters (prev => newValue)
	const derivedAtom = atom(
		(get) => get(baseAtom),
		(_get, set, update: T | ((prev: T) => T)) => {
			// Guard against undefined - don't persist undefined values
			// JSON.stringify(undefined) returns undefined (not "undefined" string)
			// but localStorage.setItem coerces to "undefined" string, causing parse failures
			if (update === undefined) {
				console.error(`Attempted to save undefined to storage key: ${key}`);
				return;
			}

			// Resolve function updaters to get the actual value
			// This is critical: JSON.stringify(function) returns undefined,
			// which would corrupt localStorage with the string "undefined"
			const resolvedValue: T =
				typeof update === "function"
					? (update as (prev: T) => T)(_get(baseAtom))
					: update;

			// Guard against resolved value being undefined (from buggy updater functions)
			if (resolvedValue === undefined) {
				console.error(
					`Function updater returned undefined for storage key: ${key}`,
				);
				return;
			}

			set(baseAtom, resolvedValue);

			// Persist the resolved value (not the function) to storage
			const adapter = getStorageAdapter();
			const saveResult = adapter.setItem(key, JSON.stringify(resolvedValue));
			if (saveResult instanceof Promise) {
				saveResult.catch((err) => {
					console.error(`Failed to save ${key} to storage`, err);
				});
			}
		},
	);

	return derivedAtom as WritableAtom<T, [T | ((prev: T) => T)], void>;
}
