"use client";

import { setCurrentTimeAtom, totalDurationAtom, useDAWContext } from "@wav0/daw-react";
import { time } from "@wav0/daw-sdk";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { DAW_BUTTONS, DAW_TEXT } from "@/lib/constants/daw-design";

/**
 * Isolated time controls component - polls transport at 10Hz
 * Prevents parent (DAWControls) from re-rendering on time updates
 */
export const TimeControls = memo(function TimeControls() {
	const daw = useDAWContext();
	const [displayTime, setDisplayTime] = useState(0);
	const displayTimeRef = useRef(0);
	const totalDuration = useAtomValue(totalDurationAtom);
	const setCurrentTime = useSetAtom(setCurrentTimeAtom);

	const readTransportTime = useEffectEvent(
		() => daw?.getTransport().getCurrentTime() ?? 0,
	);

	useEffect(() => {
		if (!daw) return;

		// Initial sync - only update if value changed
		const initialTime = readTransportTime();
		if (Math.abs(initialTime - displayTimeRef.current) > 10) {
			displayTimeRef.current = initialTime;
			setDisplayTime(initialTime);
		}

		// Update at 10Hz (100ms) for non-critical time readout
		const interval = setInterval(() => {
			const newTime = readTransportTime();
			if (Math.abs(newTime - displayTimeRef.current) > 10) {
				displayTimeRef.current = newTime;
				setDisplayTime(newTime);
			}
		}, 100);

		return () => clearInterval(interval);
	}, [daw, readTransportTime]);

	const handleTimeChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newTime = Number(e.target.value);
			displayTimeRef.current = newTime;
			setDisplayTime(newTime);
			setCurrentTime(newTime);
		},
		[setCurrentTime],
	);

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

