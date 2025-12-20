"use client";

import type { SamplerPad } from "@wav0/daw-sdk";
import { memo } from "react";
import { SamplerPadItem } from "./sampler-pad";

type SamplerPadGridProps = {
	pads: SamplerPad[];
	selectedPadId: string | null;
	activePadIds: Set<string>;
	onPadClick: (padId: string) => void;
	onPadTrigger: (padId: string) => void;
	onPadRelease: (padId: string) => void;
	onFileDrop: (padId: string, file: File) => void;
};

/** Keyboard key labels for each pad (bottom-left to top-right) */
const PAD_KEYS = [
	"Z",
	"X",
	"C",
	"V",
	"A",
	"S",
	"D",
	"F",
	"Q",
	"W",
	"E",
	"R",
	"1",
	"2",
	"3",
	"4",
];

/**
 * 4x4 MPC-style pad grid
 * Pads are arranged bottom-left to top-right (like MPC)
 */
export const SamplerPadGrid = memo(function SamplerPadGrid({
	pads,
	selectedPadId,
	activePadIds,
	onPadClick,
	onPadTrigger,
	onPadRelease,
	onFileDrop,
}: SamplerPadGridProps) {
	// Arrange pads in MPC layout (bottom row first)
	// Row 0 (bottom): pads 0-3
	// Row 1: pads 4-7
	// Row 2: pads 8-11
	// Row 3 (top): pads 12-15
	const rows = [
		pads.slice(12, 16), // Top row
		pads.slice(8, 12),
		pads.slice(4, 8),
		pads.slice(0, 4), // Bottom row
	];

	const keyRows = [
		PAD_KEYS.slice(12, 16),
		PAD_KEYS.slice(8, 12),
		PAD_KEYS.slice(4, 8),
		PAD_KEYS.slice(0, 4),
	];

	// Row identifiers
	const rowIds = ["row-top", "row-upper", "row-lower", "row-bottom"];

	return (
		<div className="grid gap-3">
			{rows.map((row, rowIndex) => (
				<div key={rowIds[rowIndex]} className="flex gap-3">
					{row.map((pad, colIndex) => (
						<SamplerPadItem
							key={pad.id}
							pad={pad}
							keyLabel={keyRows[rowIndex][colIndex]}
							isSelected={pad.id === selectedPadId}
							isActive={activePadIds.has(pad.id)}
							onClick={() => onPadClick(pad.id)}
							onTrigger={() => onPadTrigger(pad.id)}
							onRelease={() => onPadRelease(pad.id)}
							onFileDrop={(file: File) => onFileDrop(pad.id, file)}
						/>
					))}
				</div>
			))}
		</div>
	);
});
