"use client";

import { volume } from "@wav0/daw-sdk";
import { useEffect, useState } from "react";
import { playbackService } from "@/lib/daw-sdk";
import { cn } from "@/lib/utils";

export function MasterMeter() {
	const [db, setDb] = useState(Number.NEGATIVE_INFINITY);

	useEffect(() => {
		const interval = setInterval(() => {
			const currentDb = playbackService.getMasterDb();
			setDb(currentDb);
		}, 50); // Update UI at 20Hz

		return () => clearInterval(interval);
	}, []);

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
				<div className="flex h-full gap-[1px]">
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
					className="absolute top-0 bottom-0 w-[1px] bg-white/50"
					style={{ left: `${((0 - minDb) / (maxDb - minDb)) * 100}%` }}
				/>
			</div>

			<span className="text-xs font-mono tabular-nums min-w-[50px] text-right">
				{Number.isFinite(db) ? volume.formatDb(db) : "-∞ dB"}
			</span>
		</div>
	);
}
