"use client";

import { isPlayingAtom, serviceRegistry } from "@wav0/daw-react";
import { volume } from "@wav0/daw-sdk";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function MasterMeter() {
	const isPlaying = useAtomValue(isPlayingAtom);
	const [db, setDb] = useState(Number.NEGATIVE_INFINITY);
	const lastDbRef = useRef(Number.NEGATIVE_INFINITY);

	useEffect(() => {
		let rafId: number | null = null;
		let disposed = false;

		if (!isPlaying) {
			setDb(Number.NEGATIVE_INFINITY);
			lastDbRef.current = Number.NEGATIVE_INFINITY;
			return () => {
				disposed = true;
				if (rafId !== null) cancelAnimationFrame(rafId);
			};
		}

		const tick = () => {
			if (disposed) return;
			const currentDb =
				serviceRegistry.playbackService?.getMasterDb() ??
				Number.NEGATIVE_INFINITY;

			// Avoid re-renders when value is effectively unchanged
			if (Math.abs(currentDb - lastDbRef.current) > 0.25) {
				lastDbRef.current = currentDb;
				setDb(currentDb);
			}

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);

		return () => {
			disposed = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	}, [isPlaying]);

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
}
