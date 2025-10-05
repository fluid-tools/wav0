"use client";

import { MoveVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	clampAutomationDb,
	dbToMultiplier,
	formatDb,
	getCurveDescription,
	getEffectiveDb,
	multiplierToDb,
	volumeToDb,
} from "@/lib/daw-sdk";
import type { TrackEnvelopePoint } from "@/lib/daw-sdk";
import { formatDuration } from "@/lib/storage/opfs";
import { CurvePreview } from "../controls/curve-preview";

type EnvelopeEditorProps = {
	points: TrackEnvelopePoint[];
	onChange: (points: TrackEnvelopePoint[]) => void;
	onSave: () => void;
	clipStartTime: number;
	trackVolume: number;
};

const curveItems = [
	{ label: "Linear", value: "linear" as const },
	{ label: "Ease in", value: "easeIn" as const },
	{ label: "Ease out", value: "easeOut" as const },
	{ label: "S-curve", value: "sCurve" as const },
];

/**
 * Envelope Editor for clip drawer
 *
 * NOTE: This component displays a DRAFT of the track's automation.
 * Changes are applied via the Save button, which calls onSave().
 * External changes (from automation lane) sync via useEffect in use-clip-inspector.
 */
export function EnvelopeEditor({
	points,
	onChange,
	onSave,
	clipStartTime,
	trackVolume,
}: EnvelopeEditorProps) {
	const handlePointChange = (
		index: number,
		updates: Partial<TrackEnvelopePoint>,
	) => {
		onChange(
			points.map((point, idx) =>
				idx === index ? { ...point, ...updates } : point,
			),
		);
	};

	const handlePointRemove = (index: number) => {
		onChange(points.filter((_, idx) => idx !== index));
	};

	const handlePointAdd = () => {
		const sortedPoints = [...points].sort((a, b) => a.time - b.time);
		const last = sortedPoints.at(-1);
		const nextTime = last ? last.time + 1000 : clipStartTime;
		onChange([
			...points,
			{
				id: crypto.randomUUID(),
				time: nextTime,
				value: 1.0, // 100% = no change from base volume
				curve: "linear",
			},
		]);
	};

	const sortedPoints = [...points].sort((a, b) => a.time - b.time);

	return (
		<div className="space-y-4 rounded-xl border border-dashed border-primary/40 bg-background/40 p-4">
			<header className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<MoveVertical className="size-4 text-muted-foreground" />
					<div className="text-sm font-medium text-foreground">
						Volume Automation
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handlePointAdd}
						title="Add envelope point"
						aria-label="Add envelope point"
					>
						<Plus className="size-4" />
						<span className="sr-only">Add envelope point</span>
					</Button>
					<Button
						variant="outline"
						size="xs"
						onClick={onSave}
						title="Save envelope changes"
						aria-label="Save envelope changes"
					>
						Save
					</Button>
				</div>
			</header>

			<div className="rounded-lg border border-border/50 bg-background/50 p-3">
				<div className="mb-3 flex items-center justify-between text-xs">
					<span className="text-muted-foreground">
						Base: {formatDb(volumeToDb(trackVolume), 1)}
					</span>
					<span className="text-muted-foreground">
						{sortedPoints.length} automation point
						{sortedPoints.length !== 1 ? "s" : ""}
					</span>
				</div>

				{sortedPoints.length === 0 ? (
					<div className="py-8 text-center">
						<p className="text-sm text-muted-foreground">
							No automation points yet
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Click + to add points and shape your volume curve
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{sortedPoints.map((point) => {
							const originalIndex = points.findIndex((p) => p.id === point.id);
							const envelopeDb = multiplierToDb(point.value);
							const effectiveDb = getEffectiveDb(trackVolume, point.value);
							const isUnity = Math.abs(point.value - 1.0) < 0.01;

							return (
								<div
									key={point.id}
									className="group relative rounded-lg border border-border/40 bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
								>
									<div className="mb-2 flex items-start justify-between gap-2">
										<div className="flex-1">
											<div className="flex items-baseline gap-2">
												<span className="font-mono text-sm font-medium text-foreground">
													{formatDuration(point.time)}
												</span>
												<span className="text-sm font-semibold text-foreground">
													→ {formatDb(effectiveDb, 1)}
												</span>
											</div>
											<div className="mt-0.5 text-xs text-muted-foreground">
												{isUnity
													? "Unity gain (no change)"
													: `${formatDb(envelopeDb, 1)} envelope`}
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={() => handlePointRemove(originalIndex)}
											disabled={points.length <= 1}
											title="Remove point"
											aria-label={`Remove envelope point at ${formatDuration(point.time)}`}
											className="opacity-0 transition-opacity group-hover:opacity-100"
										>
											<X className="size-4" />
											<span className="sr-only">Remove point</span>
										</Button>
									</div>

									<div className="grid gap-3 sm:grid-cols-3">
										<div className="space-y-1.5">
											<label
												className="text-xs font-medium text-muted-foreground"
												htmlFor={`envelope-time-${point.id}`}
											>
												Time
											</label>
											<Input
												id={`envelope-time-${point.id}`}
												type="number"
												min={0}
												step={100}
												value={Math.round(point.time)}
												onChange={(event) =>
													handlePointChange(originalIndex, {
														time: Number(event.target.value) || 0,
													})
												}
												className="h-9 font-mono text-xs"
												aria-label="Time in milliseconds"
											/>
										</div>
										<div className="space-y-1.5">
											<label
												className="text-xs font-medium text-muted-foreground"
												htmlFor={`envelope-db-${point.id}`}
											>
												Gain (dB)
											</label>
											<Input
												id={`envelope-db-${point.id}`}
												type="number"
												min={-60}
												max={12}
												step={0.5}
												value={Number(multiplierToDb(point.value).toFixed(1))}
												onChange={(event) => {
													const db = Number(event.target.value) || 0;
													const clamped = clampAutomationDb(db);
													const multiplier = dbToMultiplier(clamped);
													handlePointChange(originalIndex, {
														value: multiplier,
													});
												}}
												className="h-9 font-mono text-xs"
												aria-label="Gain in decibels"
												title={`${formatDb(envelopeDb, 1)} envelope · ${formatDb(effectiveDb, 1)} effective`}
											/>
										</div>
										<div className="space-y-1.5">
											<label
												className="text-xs font-medium text-muted-foreground"
												htmlFor={`envelope-curve-${point.id}`}
											>
												Curve
											</label>
											<Select
												value={point.curve ?? "linear"}
												onValueChange={(value) =>
													handlePointChange(originalIndex, {
														curve: value as TrackEnvelopePoint["curve"],
													})
												}
											>
												<SelectTrigger
													className="h-9 text-sm"
													id={`envelope-curve-${point.id}`}
												>
													<SelectValue placeholder="Curve" />
												</SelectTrigger>
												<SelectContent>
													{curveItems.map((item) => (
														<SelectItem key={item.value} value={item.value}>
															{item.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>

									{/* Curve Shape Parameter */}
									{point.curve && point.curve !== "linear" && (
										<div className="space-y-2">
											<div className="flex items-center justify-between gap-2">
												<label
													className="text-xs font-medium text-muted-foreground"
													htmlFor={`envelope-shape-${point.id}`}
												>
													Curve Shape
												</label>
												<span className="text-xs font-mono text-muted-foreground tabular-nums">
													{((point.curveShape ?? 0.5) * 100).toFixed(0)}%
												</span>
											</div>
											<input
												type="range"
												id={`envelope-shape-${point.id}`}
												min={0}
												max={100}
												step={1}
												value={(point.curveShape ?? 0.5) * 100}
												onChange={(e) =>
													handlePointChange(originalIndex, {
														curveShape: parseInt(e.target.value, 10) / 100,
													})
												}
												className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-muted hover:bg-muted/80 transition-colors"
												aria-label="Curve shape parameter"
											/>
											<div className="flex justify-between text-[10px] text-muted-foreground">
												<span>Gentle</span>
												<span>Balanced</span>
												<span>Steep</span>
											</div>

											{/* Visual Preview */}
											<div className="flex items-center justify-center p-3 rounded-md bg-muted/30">
												<CurvePreview
													type={point.curve}
													shape={point.curveShape ?? 0.5}
													width={160}
													height={60}
													className="text-primary"
													strokeWidth={2.5}
												/>
											</div>
											<p className="text-[10px] text-muted-foreground text-center">
												{getCurveDescription(point.curve)}
											</p>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			<div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
				<p className="font-medium text-foreground">How automation works:</p>
				<ul className="mt-2 space-y-1 ml-4 list-disc">
					<li>
						Base volume is <strong>{trackVolume}%</strong> (set by main slider)
					</li>
					<li>
						Each point is a <strong>multiplier</strong> of base volume
					</li>
					<li>100% = no change, 50% = half volume, 200% = double volume</li>
					<li>Points are sorted by time automatically</li>
				</ul>
			</div>
		</div>
	);
}
