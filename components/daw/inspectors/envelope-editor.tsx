"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { TrackEnvelopePoint } from "@/lib/state/daw-store";

type EnvelopeEditorProps = {
	points: TrackEnvelopePoint[];
	onChange: (points: TrackEnvelopePoint[]) => void;
	onSave: () => void;
	clipStartTime: number;
};

const curveItems = [
	{ label: "Linear", value: "linear" as const },
	{ label: "Ease in", value: "easeIn" as const },
	{ label: "Ease out", value: "easeOut" as const },
	{ label: "S-curve", value: "sCurve" as const },
];

export function EnvelopeEditor({
	points,
	onChange,
	onSave,
	clipStartTime,
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
		const last = points.at(-1);
		const nextTime = last ? last.time + 500 : clipStartTime;
		onChange([
			...points,
			{
				id: crypto.randomUUID(),
				time: nextTime,
				value: 1.0,
				curve: "linear",
			},
		]);
	};

	return (
		<div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-background/40 p-4">
			<header className="flex items-center justify-between">
				<div className="text-xs font-medium text-muted-foreground">
					Envelope points · {points.length}
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

			<div className="space-y-3">
				{points.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No points yet. Add one to begin shaping the gain curve.
					</p>
				) : (
					points.map((point, index) => (
						<div
							key={point.id}
							className="grid gap-2 rounded-lg border border-border/50 bg-background/70 px-3 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
						>
							<div className="space-y-1">
								<label
									className="text-[10px] uppercase tracking-wide text-muted-foreground"
									htmlFor={`envelope-time-${point.id}`}
								>
									Time (ms)
								</label>
								<Input
									id={`envelope-time-${point.id}`}
									type="number"
									min={0}
									value={Math.round(point.time)}
									onChange={(event) =>
										handlePointChange(index, {
											time: Number(event.target.value) || 0,
										})
									}
								/>
							</div>
							<div className="space-y-1">
								<label
									className="text-[10px] uppercase tracking-wide text-muted-foreground"
									htmlFor={`envelope-gain-${point.id}`}
								>
									Gain (%)
								</label>
								<Input
									id={`envelope-gain-${point.id}`}
									type="number"
									min={0}
									max={400}
									value={Math.round(point.value * 100)}
									onChange={(event) =>
										handlePointChange(index, {
											value: (Number(event.target.value) || 0) / 100,
										})
									}
								/>
							</div>
							<div className="space-y-1">
								<label
									className="text-[10px] uppercase tracking-wide text-muted-foreground"
									htmlFor={`envelope-curve-${point.id}`}
								>
									Curve
								</label>
								<Select
									value={point.curve ?? "linear"}
									onValueChange={(value) =>
										handlePointChange(index, {
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
							<div className="flex items-end justify-end">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => handlePointRemove(index)}
								disabled={points.length <= 1}
								title="Remove point"
								aria-label={`Remove envelope point at ${Math.round(point.time)}ms`}
							>
								<X className="size-4" />
								<span className="sr-only">Remove point</span>
							</Button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

