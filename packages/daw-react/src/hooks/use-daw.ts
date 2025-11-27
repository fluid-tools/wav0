/**
 * useDAW hook - Initialize and manage DAW instance
 */

"use client";

import { createDAW, type DAW, type DAWConfig } from "@wav0/daw-sdk";
import { useEffect, useRef, useState } from "react";

export function useDAW(config?: DAWConfig): DAW | undefined {
	const [daw, setDaw] = useState<DAW | undefined>(undefined);
	const configRef = useRef(config);

	useEffect(() => {
		const instance = createDAW(configRef.current || {});
		setDaw(instance);

		// Resume audio context on user interaction
		const handleInteraction = () => {
			instance.resumeContext();
		};

		document.addEventListener("click", handleInteraction, { once: true });
		document.addEventListener("keydown", handleInteraction, { once: true });

		return () => {
			instance.dispose();
			document.removeEventListener("click", handleInteraction);
			document.removeEventListener("keydown", handleInteraction);
		};
	}, []);

	return daw;
}
