"use client";
import { useAtom } from "jotai";
import { gridAtom, musicalMetadataAtom } from "@/lib/daw-sdk";
import {
	barsBeatsToMs,
	formatBarsBeatsTicks,
	generateBarsGrid,
	getDivisionBeats,
	msToBarsBeats,
	msToBeats,
	snapTimeMs,
} from "@/lib/daw-sdk/utils/time-utils";

export function useTimebase() {
	const [grid, setGrid] = useAtom(gridAtom);
	const [music] = useAtom(musicalMetadataAtom);

	function snap(ms: number): number {
		return snapTimeMs(ms, grid, music.tempoBpm, music.timeSignature);
	}

	function format(ms: number): string {
		if (grid.mode === "time") return `${ms.toFixed(0)} ms`;
		return formatBarsBeatsTicks(ms, music.tempoBpm, music.timeSignature);
	}

	function getGridSubdivisions(widthPx: number, pxPerMs: number) {
		if (grid.mode === "time")
			return [] as Array<{
				timeMs: number;
				posPx: number;
				emphasis: "measure" | "beat" | "sub";
			}>;
		return generateBarsGrid(
			widthPx,
			pxPerMs,
			music.tempoBpm,
			music.timeSignature,
			grid.resolution,
			Boolean(grid.triplet),
			Number(grid.swing) || 0,
		);
	}

	function getGridSubdivisionsInView(
		viewStartMs: number,
		viewEndMs: number,
		pxPerMs: number,
	): {
		measures: Array<{ ms: number; bar: number }>;
		beats: Array<{ ms: number; primary: boolean }>;
		subs: number[];
	} {
		if (grid.mode === "time") {
			return { measures: [], beats: [], subs: [] };
		}

		const measures: Array<{ ms: number; bar: number }> = [];
		const beats: Array<{ ms: number; primary: boolean }> = [];
		const subs: number[] = [];

		// Calculate musical timing
		const secondsPerBeat =
			(60 / music.tempoBpm) * (4 / music.timeSignature.den);
		const msPerBeat = secondsPerBeat * 1000;
		const msPerBar = music.timeSignature.num * msPerBeat;

		// Compound grouping: if den===8 and num % 3 === 0, group beats by 3
		const isCompound =
			music.timeSignature.den === 8 && music.timeSignature.num % 3 === 0;
		const groupBeats = isCompound ? 3 : 1;

		// Get subdivision info
		const divisionBeats = getDivisionBeats(
			grid.resolution,
			music.timeSignature,
		);
		const subdivBeats = grid.triplet ? divisionBeats / 3 : divisionBeats;

		// Iterate bars from view start to view end
		const startBar = Math.floor(viewStartMs / msPerBar);
		const endBar = Math.ceil(viewEndMs / msPerBar);

		for (let barIndex = startBar; barIndex <= endBar; barIndex++) {
			const barMs = barIndex * msPerBar;

			// Add measure if in range
			if (barMs >= viewStartMs && barMs <= viewEndMs) {
				measures.push({ ms: barMs, bar: barIndex + 1 });
			}

			// Add beats within this bar
			for (let k = 0; k < music.timeSignature.num; k++) {
				const beatMs = barMs + k * msPerBeat;
				if (beatMs >= viewStartMs && beatMs <= viewEndMs && beatMs !== barMs) {
					const primary = k % groupBeats === 0;
					beats.push({ ms: beatMs, primary });
				}
			}

			// Add subdivisions
			const divisionsPerBar = music.timeSignature.num / subdivBeats;
			for (let i = 1; i < divisionsPerBar; i++) {
				const subMs = barMs + i * subdivBeats * msPerBeat;
				if (subMs >= viewStartMs && subMs <= viewEndMs) {
					// Apply swing visual bias only to subs (even index)
					let finalSubMs = subMs;
					if (grid.swing && grid.swing > 0 && !grid.triplet) {
						const isEven = i % 2 === 0;
						const bias = isEven
							? 0
							: grid.swing * (2 / 3 - 1 / 2) * subdivBeats * msPerBeat;
						finalSubMs += bias;
					}
					subs.push(finalSubMs);
				}
			}
		}

		// Density gates (declutter based on pixel spacing)
		const pxPerBeat = pxPerMs * msPerBeat;
		const pxPerSub = pxPerMs * subdivBeats * msPerBeat;

		// Filter based on pixel density
		const filteredBeats =
			pxPerBeat >= 8
				? beats
				: pxPerBeat >= 14
					? beats.filter((b) => b.primary)
					: [];
		const filteredSubs = pxPerSub >= 12 ? subs : [];

		return {
			measures,
			beats: filteredBeats,
			subs: filteredSubs,
		};
	}

	function getStepMs() {
		// current subdivision duration in ms
		if (grid.mode === "time") return 100; // fallback 100ms
		// Use divisionBeats from time-utils for correctness
		const den = music.timeSignature.den;
		const secondsPerBeat = (60 / music.tempoBpm) * (4 / den);
		const divisionBeats =
			music.timeSignature.num / Number(grid.resolution.split("/")[1]);
		const subdivBeats = grid.triplet ? divisionBeats / 3 : divisionBeats;
		return subdivBeats * secondsPerBeat * 1000;
	}

	return {
		grid,
		setGrid,
		tempoBpm: music.tempoBpm,
		timeSignature: music.timeSignature,
		snap,
		format,
		getGridSubdivisions,
		getGridSubdivisionsInView,
		stepMs: getStepMs(),
		msToBeats: (ms: number) =>
			msToBeats(ms, music.tempoBpm, music.timeSignature),
		msToBarsBeats: (ms: number) =>
			msToBarsBeats(ms, music.tempoBpm, music.timeSignature),
		barsBeatsToMs: (pos: { bar: number; beat: number; tick?: number }) =>
			barsBeatsToMs(pos, music.tempoBpm, music.timeSignature),
	};
}
