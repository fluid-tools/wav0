/**
 * useDAW hook - Initialize and manage DAW instance
 */

"use client";

import { createDAW, type DAW, type DAWConfig } from "@wav0/daw-sdk";
import { useEffect, useRef } from "react";

export function useDAW(config?: DAWConfig): DAW | undefined {
	const dawRef = useRef<DAW | undefined>(undefined);
	const configRef = useRef(config);

	useEffect(() => {
		dawRef.current = createDAW(configRef.current || {});

		// Resume audio context on user interaction
		const handleInteraction = () => {
			dawRef.current?.resumeContext();
		};

		document.addEventListener("click", handleInteraction, { once: true });
		document.addEventListener("keydown", handleInteraction, { once: true });

		return () => {
			dawRef.current?.dispose();
			document.removeEventListener("click", handleInteraction);
			document.removeEventListener("keydown", handleInteraction);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return dawRef.current;
}
