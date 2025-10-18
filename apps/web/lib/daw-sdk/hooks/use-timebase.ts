"use client";
import { useAtom } from "jotai";
import { gridAtom, musicalMetadataAtom } from "@/lib/daw-sdk";
import {
	barsBeatsToMs,
	formatBarsBeatsTicks,
	generateBarsGrid,
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
		stepMs: getStepMs(),
		msToBeats: (ms: number) =>
			msToBeats(ms, music.tempoBpm, music.timeSignature),
		msToBarsBeats: (ms: number) =>
			msToBarsBeats(ms, music.tempoBpm, music.timeSignature),
		barsBeatsToMs: (pos: { bar: number; beat: number; tick?: number }) =>
			barsBeatsToMs(pos, music.tempoBpm, music.timeSignature),
	};
}
