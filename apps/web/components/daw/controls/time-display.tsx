"use client";

import { setCurrentTimeAtom, totalDurationAtom, useDAWContext } from "@wav0/daw-react";
import {
	TIME_DISPLAY_CHANGE_THRESHOLD_MS,
	TIME_DISPLAY_UPDATE_INTERVAL_MS,
	time,
} from "@wav0/daw-sdk";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useEffect, useEffectEvent, useRef, useState } from "react";
import { DAW_BUTTONS, DAW_TEXT } from "@/lib/constants/daw-design";

/**
 * Isolated time controls component - polls transport at 10Hz
 * Prevents parent (DAWControls) from re-rendering on time updates
 */
export const TimeControls = memo(function TimeControls() {
	const daw = useDAWContext();
	const [displayTime, setDisplayTime] = useState(0);
	const displayTimeRef = useRef(0);
	const initializedRef = useRef(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const totalDuration = useAtomValue(totalDurationAtom);
	const setCurrentTime = useSetAtom(setCurrentTimeAtom);

	// useEffectEvent returns stable fn - do NOT include in deps
	const readTransportTime = useEffectEvent(
		() => daw?.getTransport().getCurrentTime() ?? 0,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: readTransportTime is from useEffectEvent - stable by design
	useEffect(() => {
		if (!daw) return;

		// Clear any existing interval to prevent stacking
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		// Sync on each daw instance change (initializedRef tracks per-instance init)
		if (!initializedRef.current) {
			initializedRef.current = true;
			const initialTime = readTransportTime();
			displayTimeRef.current = initialTime;
			setDisplayTime(initialTime);
		}

		// Update at 10Hz (TIME_DISPLAY_UPDATE_INTERVAL_MS) - humans can't read faster
		intervalRef.current = setInterval(() => {
			const newTime = readTransportTime();
			// Only update if change exceeds threshold (TIME_DISPLAY_CHANGE_THRESHOLD_MS)
			if (Math.abs(newTime - displayTimeRef.current) > TIME_DISPLAY_CHANGE_THRESHOLD_MS) {
				displayTimeRef.current = newTime;
				setDisplayTime(newTime);
			}
		}, TIME_DISPLAY_UPDATE_INTERVAL_MS);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			// Reset flag so next daw instance triggers re-init
			initializedRef.current = false;
		};
	}, [daw]);

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTime = Number(e.target.value);
		displayTimeRef.current = newTime;
		setDisplayTime(newTime);
		setCurrentTime(newTime);
	};

	const percentage = totalDuration > 0 ? (displayTime / totalDuration) * 100 : 0;

	return (
		<div className={`flex items-center gap-3 ${DAW_BUTTONS.PANEL} px-3 py-1.5`}>
			<span className={`${DAW_TEXT.MONO_TIME} min-w-14`}>
				{time.formatDuration(displayTime)}
			</span>
			<div className="relative flex-1">
				<input
					type="range"
					min={0}
					max={totalDuration}
					value={displayTime}
					onChange={handleTimeChange}
					className="w-48 h-1.5 bg-muted/50 rounded-full appearance-none cursor-pointer slider"
					style={{
						background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
					}}
				/>
			</div>
			<span className={`${DAW_TEXT.MONO_TIME} min-w-14`}>
				{time.formatDuration(totalDuration)}
			</span>
		</div>
	);
});

