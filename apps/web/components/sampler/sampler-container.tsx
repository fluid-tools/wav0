"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { SamplerProvider, useSamplerContext } from "./sampler-context";
import { SamplerHeader } from "./sampler-header";
import { SamplerInspector } from "./sampler-inspector";
import { SamplerPadGrid } from "./sampler-pad-grid";

// ============================================================================
// Keyboard mappings
// ============================================================================

const KEY_TO_PAD: Record<string, number> = {
	// Bottom row (pads 0-3)
	z: 0,
	x: 1,
	c: 2,
	v: 3,
	// Second row (pads 4-7)
	a: 4,
	s: 5,
	d: 6,
	f: 7,
	// Third row (pads 8-11)
	q: 8,
	w: 9,
	e: 10,
	r: 11,
	// Top row (pads 12-15)
	"1": 12,
	"2": 13,
	"3": 14,
	"4": 15,
};

// ============================================================================
// Inner component that uses the context
// ============================================================================

function SamplerUI() {
	const {
		isReady,
		pads,
		selectedPadId,
		activePadIds,
		selectPad,
		triggerPad,
		releasePad,
		loadSample,
		clearSample,
		updatePad,
		updateEnvelope,
		stopAll,
		setPadActive,
		setPadInactive,
	} = useSamplerContext();

	// Keyboard handling
	useEffect(() => {
		const pressedKeys = new Set<string>();

		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if typing in input
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			const key = e.key.toLowerCase();
			const padIndex = KEY_TO_PAD[key];

			if (padIndex !== undefined && !pressedKeys.has(key)) {
				e.preventDefault();
				pressedKeys.add(key);
				const padId = `pad-${padIndex}`;
				setPadActive(padId);
				triggerPad(padId, 100);
			}

			// Escape to clear selection
			if (e.key === "Escape") {
				selectPad(null);
			}

			// Space to stop all
			if (e.key === " ") {
				e.preventDefault();
				stopAll();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();
			const padIndex = KEY_TO_PAD[key];

			if (padIndex !== undefined) {
				pressedKeys.delete(key);
				const padId = `pad-${padIndex}`;
				setPadInactive(padId);
				releasePad(padId);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [
		triggerPad,
		releasePad,
		selectPad,
		stopAll,
		setPadActive,
		setPadInactive,
	]);

	// Handle file drop on a pad
	const handleFileDrop = async (padId: string, file: File) => {
		const error = await loadSample(padId, file);
		if (error) {
			toast.error(`Failed to load: ${error}`);
		} else {
			toast.success(`Loaded "${file.name}"`);
			selectPad(padId);
		}
	};

	// Handle pad trigger (pointer down)
	const handlePadTrigger = (padId: string) => {
		setPadActive(padId);
		triggerPad(padId, 100);
	};

	// Handle pad release (pointer up)
	const handlePadRelease = (padId: string) => {
		setPadInactive(padId);
		releasePad(padId);
	};

	// Get selected pad
	const selectedPad = pads.find((p) => p.id === selectedPadId) ?? null;

	// Loading state
	if (!isReady) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="text-muted-foreground">Loading sampler...</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col bg-background">
			{/* Header */}
			<SamplerHeader onStopAll={stopAll} />

			{/* Main content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Pad grid - centered */}
				<div className="flex flex-1 items-center justify-center p-8">
					<SamplerPadGrid
						pads={pads}
						selectedPadId={selectedPadId}
						activePadIds={activePadIds}
						onPadClick={selectPad}
						onPadTrigger={handlePadTrigger}
						onPadRelease={handlePadRelease}
						onFileDrop={handleFileDrop}
					/>
				</div>

				{/* Inspector panel */}
				{selectedPad && (
					<SamplerInspector
						pad={selectedPad}
						onUpdatePad={(updates) => updatePad(selectedPad.id, updates)}
						onUpdateEnvelope={(envelope) =>
							updateEnvelope(selectedPad.id, envelope)
						}
						onClearSample={() => clearSample(selectedPad.id)}
						onClose={() => selectPad(null)}
					/>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Main container with provider
// ============================================================================

export function SamplerContainer() {
	return (
		<SamplerProvider>
			<SamplerUI />
		</SamplerProvider>
	);
}
