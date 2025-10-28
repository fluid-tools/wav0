/**
 * Performance profiling utilities for DAW components
 */

export class PerformanceProfiler {
	private static marks = new Map<string, number>();

	static mark(name: string) {
		if (typeof performance === "undefined") return;
		performance.mark(name);
		PerformanceProfiler.marks.set(name, performance.now());
	}

	static measure(name: string, startMark: string, endMark?: string) {
		if (typeof performance === "undefined") return;

		try {
			if (endMark) {
				performance.measure(name, startMark, endMark);
			} else {
				performance.mark(`${name}-end`);
				performance.measure(name, startMark, `${name}-end`);
			}

			const measure = performance.getEntriesByName(name, "measure")[0];
			if (measure && measure.duration > 16) {
				// Log if > 1 frame
				console.warn(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
			}
		} catch (e) {
			// Marks might not exist
		}
	}

	static logRenderTime(componentName: string, duration: number) {
		if (duration > 16) {
			console.warn(
				`[Performance] ${componentName} render: ${duration.toFixed(2)}ms`,
			);
		}
	}

	static clear() {
		if (typeof performance === "undefined") return;
		performance.clearMarks();
		performance.clearMeasures();
		PerformanceProfiler.marks.clear();
	}
}

/**
 * Debounce function for window resize handlers
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;

	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			timeout = null;
			func(...args);
		};

		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function for high-frequency updates
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	let lastResult: ReturnType<T>;

	return function executedFunction(
		...args: Parameters<T>
	): ReturnType<T> | undefined {
		if (!inThrottle) {
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
			lastResult = func(...args);
			return lastResult;
		}
	};
}
