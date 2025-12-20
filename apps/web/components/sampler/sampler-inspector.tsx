"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ADSREnvelope, PlayMode, SamplerPad } from "@wav0/daw-sdk";
import { Trash2, X } from "lucide-react";
import { memo, useCallback } from "react";

type SamplerInspectorProps = {
	pad: SamplerPad;
	onUpdatePad: (updates: Partial<SamplerPad>) => void;
	onUpdateEnvelope: (envelope: Partial<ADSREnvelope>) => void;
	onClearSample: () => void;
	onClose: () => void;
};

/**
 * Inspector panel for editing selected pad properties
 */
export const SamplerInspector = memo(function SamplerInspector({
	pad,
	onUpdatePad,
	onUpdateEnvelope,
	onClearSample,
	onClose,
}: SamplerInspectorProps) {
	const hasSample = pad.audioBuffer !== null;

	// Handle name change
	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			onUpdatePad({ name: e.target.value });
		},
		[onUpdatePad],
	);

	// Handle play mode change
	const handlePlayModeChange = useCallback(
		(value: string) => {
			onUpdatePad({ playMode: value as PlayMode });
		},
		[onUpdatePad],
	);

	// Handle volume change
	const handleVolumeChange = useCallback(
		(value: number[]) => {
			onUpdatePad({ volume: value[0] });
		},
		[onUpdatePad],
	);

	// Handle pan change
	const handlePanChange = useCallback(
		(value: number[]) => {
			onUpdatePad({ pan: value[0] });
		},
		[onUpdatePad],
	);

	// Handle pitch change
	const handlePitchChange = useCallback(
		(value: number[]) => {
			onUpdatePad({ pitchShift: value[0] });
		},
		[onUpdatePad],
	);

	// ADSR handlers
	const handleAttackChange = useCallback(
		(value: number[]) => {
			onUpdateEnvelope({ attack: value[0] });
		},
		[onUpdateEnvelope],
	);

	const handleDecayChange = useCallback(
		(value: number[]) => {
			onUpdateEnvelope({ decay: value[0] });
		},
		[onUpdateEnvelope],
	);

	const handleSustainChange = useCallback(
		(value: number[]) => {
			onUpdateEnvelope({ sustain: value[0] });
		},
		[onUpdateEnvelope],
	);

	const handleReleaseChange = useCallback(
		(value: number[]) => {
			onUpdateEnvelope({ release: value[0] });
		},
		[onUpdateEnvelope],
	);

	return (
		<aside className="flex w-80 flex-col border-l bg-card">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="text-sm font-semibold">Pad Inspector</h2>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<X className="size-4" />
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-6">
					{/* Name */}
					<div className="space-y-2">
						<span className="text-xs font-medium text-muted-foreground">
							Name
						</span>
						<Input
							value={pad.name}
							onChange={handleNameChange}
							className="h-8"
							aria-label="Pad name"
						/>
					</div>

					{/* Sample info */}
					{hasSample && pad.sampleInfo && (
						<div className="space-y-2">
							<span className="text-xs font-medium text-muted-foreground">
								Sample
							</span>
							<div className="rounded-md border bg-muted/50 p-2 text-xs">
								<div className="flex justify-between">
									<span>Duration</span>
									<span className="font-mono">
										{pad.sampleInfo.duration.toFixed(2)}s
									</span>
								</div>
								<div className="flex justify-between">
									<span>Sample Rate</span>
									<span className="font-mono">
										{(pad.sampleInfo.sampleRate / 1000).toFixed(1)} kHz
									</span>
								</div>
								<div className="flex justify-between">
									<span>Channels</span>
									<span className="font-mono">
										{pad.sampleInfo.channels === 1 ? "Mono" : "Stereo"}
									</span>
								</div>
							</div>
							<Button
								variant="destructive"
								size="sm"
								className="w-full gap-2"
								onClick={onClearSample}
							>
								<Trash2 className="size-3" />
								Clear Sample
							</Button>
						</div>
					)}

					{/* Play Mode */}
					<div className="space-y-2">
						<span className="text-xs font-medium text-muted-foreground">
							Play Mode
						</span>
						<Select value={pad.playMode} onValueChange={handlePlayModeChange}>
							<SelectTrigger className="h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="one-shot">One-Shot</SelectItem>
								<SelectItem value="gate">Gate</SelectItem>
								<SelectItem value="toggle">Toggle</SelectItem>
								<SelectItem value="latch">Latch</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Volume */}
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Volume
							</span>
							<span className="text-xs font-mono text-muted-foreground">
								{Math.round(pad.volume * 100)}%
							</span>
						</div>
						<Slider
							value={[pad.volume]}
							min={0}
							max={1}
							step={0.01}
							onValueChange={handleVolumeChange}
						/>
					</div>

					{/* Pan */}
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Pan
							</span>
							<span className="text-xs font-mono text-muted-foreground">
								{pad.pan === 0
									? "C"
									: pad.pan < 0
										? `${Math.round(Math.abs(pad.pan) * 100)}L`
										: `${Math.round(pad.pan * 100)}R`}
							</span>
						</div>
						<Slider
							value={[pad.pan]}
							min={-1}
							max={1}
							step={0.01}
							onValueChange={handlePanChange}
						/>
					</div>

					{/* Pitch */}
					<div className="space-y-2">
						<div className="flex justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Pitch
							</span>
							<span className="text-xs font-mono text-muted-foreground">
								{pad.pitchShift > 0 ? "+" : ""}
								{pad.pitchShift} st
							</span>
						</div>
						<Slider
							value={[pad.pitchShift]}
							min={-24}
							max={24}
							step={1}
							onValueChange={handlePitchChange}
						/>
					</div>

					{/* ADSR Envelope */}
					<div className="space-y-4">
						<span className="text-xs font-medium text-muted-foreground">
							Envelope
						</span>

						{/* Attack */}
						<div className="space-y-1">
							<div className="flex justify-between">
								<span className="text-xs text-muted-foreground">Attack</span>
								<span className="text-xs font-mono text-muted-foreground">
									{pad.envelope.attack.toFixed(0)} ms
								</span>
							</div>
							<Slider
								value={[pad.envelope.attack]}
								min={0}
								max={2000}
								step={1}
								onValueChange={handleAttackChange}
							/>
						</div>

						{/* Decay */}
						<div className="space-y-1">
							<div className="flex justify-between">
								<span className="text-xs text-muted-foreground">Decay</span>
								<span className="text-xs font-mono text-muted-foreground">
									{pad.envelope.decay.toFixed(0)} ms
								</span>
							</div>
							<Slider
								value={[pad.envelope.decay]}
								min={0}
								max={2000}
								step={1}
								onValueChange={handleDecayChange}
							/>
						</div>

						{/* Sustain */}
						<div className="space-y-1">
							<div className="flex justify-between">
								<span className="text-xs text-muted-foreground">Sustain</span>
								<span className="text-xs font-mono text-muted-foreground">
									{Math.round(pad.envelope.sustain * 100)}%
								</span>
							</div>
							<Slider
								value={[pad.envelope.sustain]}
								min={0}
								max={1}
								step={0.01}
								onValueChange={handleSustainChange}
							/>
						</div>

						{/* Release */}
						<div className="space-y-1">
							<div className="flex justify-between">
								<span className="text-xs text-muted-foreground">Release</span>
								<span className="text-xs font-mono text-muted-foreground">
									{pad.envelope.release.toFixed(0)} ms
								</span>
							</div>
							<Slider
								value={[pad.envelope.release]}
								min={0}
								max={5000}
								step={1}
								onValueChange={handleReleaseChange}
							/>
						</div>
					</div>

					{/* Mute/Solo */}
					<div className="flex gap-2">
						<Button
							variant={pad.muted ? "destructive" : "outline"}
							size="sm"
							className="flex-1"
							onClick={() => onUpdatePad({ muted: !pad.muted })}
						>
							{pad.muted ? "Unmute" : "Mute"}
						</Button>
						<Button
							variant={pad.soloed ? "default" : "outline"}
							size="sm"
							className={cn("flex-1", pad.soloed && "bg-yellow-500")}
							onClick={() => onUpdatePad({ soloed: !pad.soloed })}
						>
							{pad.soloed ? "Unsolo" : "Solo"}
						</Button>
					</div>
				</div>
			</div>
		</aside>
	);
});
