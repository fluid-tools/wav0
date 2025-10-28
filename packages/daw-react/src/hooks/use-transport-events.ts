/**
 * Transport Event Hook
 * Subscribe to Transport state changes and update React state
 */

"use client";

import type { TransportEvent, TransportState } from "@wav0/daw-sdk";
import { useEffect } from "react";
import { useDAWContext } from "../providers/daw-provider";

export interface UseTransportEventsOptions {
	onStateChange?: (state: TransportState, currentTime: number) => void;
	onPlay?: () => void;
	onStop?: () => void;
	onPause?: () => void;
	onSeek?: (time: number) => void;
}

/**
 * Hook to listen to Transport events
 * Automatically cleans up listeners on unmount
 */
export function useTransportEvents(options: UseTransportEventsOptions = {}) {
	const daw = useDAWContext();

	useEffect(() => {
		if (!daw) return;

		const transport = daw.getTransport();

		const handleTransportEvent = ((event: CustomEvent<TransportEvent>) => {
			const { state, currentTime } = event.detail;

			// Call generic state change handler
			options.onStateChange?.(state, currentTime);

			// Call specific handlers
			switch (state) {
				case "playing":
					options.onPlay?.();
					break;
				case "stopped":
					options.onStop?.();
					break;
				case "paused":
					options.onPause?.();
					break;
			}
		}) as EventListener;

		transport.addEventListener("transport", handleTransportEvent);

		return () => {
			transport.removeEventListener("transport", handleTransportEvent);
		};
	}, [
		daw,
		options.onStateChange,
		options.onPlay,
		options.onStop,
		options.onPause,
	]);

	return {
		transport: daw?.getTransport() ?? null,
		getCurrentTime: () => daw?.getTransport().getCurrentTime() ?? 0,
		getState: () => daw?.getTransport().getState() ?? "stopped",
	};
}
