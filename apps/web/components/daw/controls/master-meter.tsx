"use client";

import { isPlayingAtom, servicesAtom } from "@wav0/daw-react";
import {
	METER_DB_CHANGE_THRESHOLD,
	METER_UPDATE_INTERVAL_MS,
	volume,
} from "@wav0/daw-sdk";
import { useAtomValue, useStore } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Memoized to prevent re-renders from parent - has its own update loop
export const MasterMeter = memo(function MasterMeter() {
	const isPlaying = useAtomValue(isPlayingAtom);
	const store = useStore();
	const [db, setDb] = useState(Number.NEGATIVE_INFINITY);
	const lastDbRef = useRef(Number.NEGATIVE_INFINITY);
	const rafIdRef = useRef<number | null>(null);
	const wasPlayingRef = useRef(false);

	useEffect(() => {
		// Cancel any existing RAF first
		if (rafIdRef.current !== null) {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}

		if (!isPlaying) {
			// Only reset if we were previously playing - prevents loop
			if (wasPlayingRef.current) {
				wasPlayingRef.current = false;
				lastDbRef.current = Number.NEGATIVE_INFINITY;
				setDb(Number.NEGATIVE_INFINITY);
			}
			return;
		}

		wasPlayingRef.current = true;
		let lastUpdateTime = 0;

		const tick = (timestamp: number) => {
			// Throttle to 30fps (METER_UPDATE_INTERVAL_MS) - industry standard for VU meters
			if (timestamp - lastUpdateTime < METER_UPDATE_INTERVAL_MS) {
				rafIdRef.current = requestAnimationFrame(tick);
				return;
			}
			lastUpdateTime = timestamp;

			const { playbackService } = store.get(servicesAtom);
			const currentDb =
				playbackService?.getMasterDb() ?? Number.NEGATIVE_INFINITY;

			// Avoid re-renders when value is effectively unchanged (METER_DB_CHANGE_THRESHOLD)
			if (Math.abs(currentDb - lastDbRef.current) > METER_DB_CHANGE_THRESHOLD) {
				lastDbRef.current = currentDb;
				setDb(currentDb);
			}

			rafIdRef.current = requestAnimationFrame(tick);
		};

		rafIdRef.current = requestAnimationFrame(tick);

		return () => {
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [isPlaying, store]);

	// Calculate fill percentage for visual bar
	const minDb = -60;
	const maxDb = 6;
	const clampedDb = Math.max(minDb, Math.min(maxDb, db));
	const percentage = Number.isFinite(clampedDb)
		? ((clampedDb - minDb) / (maxDb - minDb)) * 100
		: 0;

	return (
		<div className="flex items-center gap-2 min-w-[120px]">
			<div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
				{/* LED segments */}
				<div className="flex h-full gap-px">
					{Array.from({ length: 20 }, (_, i) => ({
						id: `meter-segment-${i}`,
						index: i,
					})).map(({ id, index: i }) => {
						const segmentPercent = (i / 20) * 100;
						const isActive = segmentPercent < percentage;
						const segmentDb = minDb + (segmentPercent / 100) * (maxDb - minDb);

						const segmentColor =
							segmentDb > 0
								? "bg-red-500"
								: segmentDb > -6
									? "bg-yellow-500"
									: "bg-green-500";

						return (
							<div
								key={id}
								className={cn(
									"flex-1 transition-opacity duration-75",
									isActive ? segmentColor : "bg-muted opacity-30",
								)}
							/>
						);
					})}
				</div>

				{/* 0dB marker */}
				<div
					className="absolute top-0 bottom-0 w-px bg-white/50"
					style={{ left: `${((0 - minDb) / (maxDb - minDb)) * 100}%` }}
				/>
			</div>

			<span className="text-xs font-mono tabular-nums min-w-[50px] text-right">
				{Number.isFinite(db) ? volume.formatDb(db) : "-∞ dB"}
			</span>
		</div>
	);
});
