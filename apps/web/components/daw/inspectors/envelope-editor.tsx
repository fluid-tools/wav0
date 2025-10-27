"use client";

import { MoveVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrackEnvelope } from "@/lib/daw-sdk";
import {
	addAutomationPoint,
	clampAutomationDb,
	dbToMultiplier,
	formatDb,
	formatDuration,
	getEffectiveDb,
	getSegmentCurveDescription,
	multiplierToDb,
	removeAutomationPoint,
	updateSegmentCurve,
	volumeToDb,
} from "@/lib/daw-sdk";
import { SegmentCurvePreview } from "../controls/segment-curve-preview";

type EnvelopeEditorProps = {
	envelope: TrackEnvelope;
	onChange: (envelope: TrackEnvelope) => void;
	clipStartTime: number;
	trackVolume: number;
};

/**
 * Envelope Editor for clip drawer - Segment-based (Logic Pro style)
 *
 * Points are just coordinates (time + value)
 * Segments between points own the curves (-99 to +99)
 * Changes are applied instantly to the track's automation.
 */
export function EnvelopeEditor({
	envelope,
	onChange,
	clipStartTime,
	trackVolume,
}: EnvelopeEditorProps) {
	const handlePointChange = (
		pointId: string,
		time?: number,
		value?: number,
	) => {
		const updatedEnvelope = {
			...envelope,
			points: envelope.points.map((point) =>
				point.id === pointId
					? {
							...point,
							...(time !== undefined
								? { time: Math.max(0, Math.round(time)) }
								: {}),
							...(value !== undefined
								? { value: Math.max(0, Math.min(4, value)) }
								: {}),
						}
					: point,
			),
		};
		onChange(updatedEnvelope);
	};

	const handlePointRemove = (pointId: string) => {
		const updatedEnvelope = removeAutomationPoint(envelope, pointId);
		onChange(updatedEnvelope);
	};

	const handlePointAdd = () => {
		const sortedPoints = [...envelope.points].sort((a, b) => a.time - b.time);
		const last = sortedPoints.at(-1);
		const nextTime = last ? last.time + 1000 : clipStartTime;

		const newPoint = {
			id: crypto.randomUUID(),
			time: nextTime,
			value: 1.0, // 100% = no change from base volume
		};

		const updatedEnvelope = addAutomationPoint(envelope, newPoint);
		onChange(updatedEnvelope);
	};

	const handleSegmentCurveChange = (segmentId: string, curve: number) => {
		const updatedEnvelope = updateSegmentCurve(envelope, segmentId, curve);
		onChange(updatedEnvelope);
	};

	const sortedPoints = [...envelope.points].sort((a, b) => a.time - b.time);

	return (
		<div className="space-y-4 rounded-xl border border-dashed border-primary/40 bg-background/40 p-4">
			<header className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<MoveVertical className="size-4 text-muted-foreground" />
					<div className="text-sm font-medium text-foreground">
						Volume Automation
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={handlePointAdd}
					title="Add automation point"
					aria-label="Add automation point"
				>
					<Plus className="size-4" />
					<span className="sr-only">Add automation point</span>
				</Button>
			</header>

			<div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
				{sortedPoints.map((point, index) => {
					const nextPoint = sortedPoints[index + 1];
					const segment = envelope.segments?.find(
						(s) => s.fromPointId === point.id && s.toPointId === nextPoint?.id,
					);

					// Calculate effective dB for this point
					const effectiveDb = getEffectiveDb(point.value, trackVolume);

					return (
						<div key={point.id} className="space-y-3">
							{/* Point Editor */}
							<div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 p-3">
								<div className="flex-1 space-y-2">
									<div className="flex items-center justify-between">
										<div className="text-xs font-medium text-muted-foreground">
											Point {index + 1}
										</div>
										{sortedPoints.length > 1 && (
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={() => handlePointRemove(point.id)}
												title="Remove point"
												aria-label="Remove point"
											>
												<X className="size-3" />
											</Button>
										)}
									</div>

									<div className="grid grid-cols-2 gap-2">
										<div>
											<label
												htmlFor={`point-time-${point.id}`}
												className="text-xs text-muted-foreground"
											>
												Time
											</label>
											<Input
												id={`point-time-${point.id}`}
												type="text"
												value={formatDuration(point.time)}
												onChange={(e) => {
													const ms = parseDuration(e.target.value);
													if (ms !== null) {
														handlePointChange(point.id, ms, undefined);
													}
												}}
												className="h-7 text-xs"
												placeholder="0:00.000"
											/>
										</div>

										<div>
											<label
												htmlFor={`point-value-${point.id}`}
												className="text-xs text-muted-foreground"
											>
												Volume
											</label>
											<Input
												id={`point-value-${point.id}`}
												type="text"
												value={formatDb(multiplierToDb(point.value))}
												onChange={(e) => {
													const db = parseFloat(e.target.value);
													if (Number.isFinite(db)) {
														const clampedDb = clampAutomationDb(db);
														const multiplier = dbToMultiplier(clampedDb);
														handlePointChange(point.id, undefined, multiplier);
													}
												}}
												className="h-7 text-xs"
												placeholder="0.0 dB"
											/>
										</div>
									</div>

									<div className="text-[10px] text-muted-foreground">
										Effective: {formatDb(effectiveDb)} (
										{volumeToDb(trackVolume)} track +{" "}
										{formatDb(multiplierToDb(point.value))} automation)
									</div>
								</div>
							</div>

							{/* Segment Editor (curve between this point and next) */}
							{segment && nextPoint && (
								<div className="ml-4 space-y-2 rounded-lg border border-border/30 bg-muted/30 p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex-1 space-y-2">
											<div className="text-xs font-medium text-muted-foreground">
												Curve to Point {index + 2}
											</div>

											<div>
												<label
													htmlFor={`segment-curve-${segment.id}`}
													className="text-xs text-muted-foreground"
												>
													Curve ({segment.curve})
												</label>
												<input
													id={`segment-curve-${segment.id}`}
													type="range"
													min={-99}
													max={99}
													step={1}
													value={segment.curve}
													onChange={(e) =>
														handleSegmentCurveChange(
															segment.id,
															parseInt(e.target.value, 10),
														)
													}
													className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted"
													style={{
														background: `linear-gradient(to right, 
															hsl(var(--primary) / 0.3) 0%, 
															hsl(var(--primary) / 0.6) ${((segment.curve + 99) / 198) * 100}%, 
															hsl(var(--muted)) ${((segment.curve + 99) / 198) * 100}%
														)`,
													}}
												/>
												<div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
													<span>-99</span>
													<span>0 (Linear)</span>
													<span>+99</span>
												</div>
											</div>

											<div className="text-[10px] text-muted-foreground">
												{getSegmentCurveDescription(segment.curve)}
											</div>
										</div>

										<div className="flex-shrink-0">
											<SegmentCurvePreview
												curve={segment.curve}
												width={80}
												height={60}
												className="text-foreground opacity-60"
												strokeWidth={1.5}
											/>
										</div>
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{sortedPoints.length === 0 && (
				<div className="text-center text-sm text-muted-foreground py-8">
					No automation points. Click{" "}
					<Plus className="inline size-3 align-middle" /> to add one.
				</div>
			)}
		</div>
	);
}

/**
 * Parse duration string to milliseconds
 * Supports formats: "1:23.456", "1:23", "23.456", "23"
 */
function parseDuration(str: string): number | null {
	const parts = str.split(":");
	if (parts.length === 1) {
		// Just seconds
		const seconds = parseFloat(parts[0]);
		return Number.isFinite(seconds) ? seconds * 1000 : null;
	}
	if (parts.length === 2) {
		// Minutes:seconds
		const minutes = parseInt(parts[0], 10);
		const seconds = parseFloat(parts[1]);
		if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
			return minutes * 60 * 1000 + seconds * 1000;
		}
	}
	return null;
}
