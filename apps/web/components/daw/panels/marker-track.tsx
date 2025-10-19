"use client";
import { useAtom } from "jotai";
import { useRef, useState } from "react";
import { markersAtom, updateMarkerAtom } from "@/lib/daw-sdk";
import { useTimebase } from "@/lib/daw-sdk/hooks/use-timebase";

type MarkerTrackProps = {
	pxPerMs: number;
	width: number;
};

export function MarkerTrack({ pxPerMs, width }: MarkerTrackProps) {
	const [markers] = useAtom(markersAtom);
	const [, updateMarker] = useAtom(updateMarkerAtom);
	const { snap } = useTimebase();
	const [editingId, setEditingId] = useState<string | null>(null);
	const dragRef = useRef<{
		id: string;
		pointerId: number;
		startX: number;
		startStart: number;
		startDur: number;
		edge: "left" | "right" | "center";
	} | null>(null);

	return (
		<div className="absolute inset-x-0 top-0 h-6" style={{ width }}>
			{markers
				.slice()
				.sort((a, b) => a.timeMs - b.timeMs)
				.map((m, idx) => {
					const start = m.timeMs;
					const duration = m.durationMs ?? 0;
					const left = start * pxPerMs;
					const markerWidth = Math.max(10, duration * pxPerMs);
					const yOffset = (idx % 2) * 2; // slight vertical offset for overlaps
					type Align = "left" | "right" | "center";

					const onDown = (e: React.PointerEvent, edge: Align) => {
						e.preventDefault();
						(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
						dragRef.current = {
							id: m.id,
							pointerId: e.pointerId,
							startX: e.clientX,
							startStart: start,
							startDur: duration,
							edge,
						};
					};
					const onMove: React.PointerEventHandler = (e) => {
						const d = dragRef.current;
						if (!d || e.pointerId !== d.pointerId) return;
						const dx = (e.clientX - d.startX) / pxPerMs;
						if (d.edge === "center") {
							const raw = Math.max(0, d.startStart + dx);
							const snapped = snap(raw);
							updateMarker(d.id, { timeMs: snapped });
						} else if (d.edge === "left") {
							const raw = Math.max(0, d.startStart + dx);
							const snapped = snap(raw);
							const newDur = Math.max(0, d.startDur + (d.startStart - snapped));
							updateMarker(d.id, { timeMs: snapped, durationMs: newDur });
						} else {
							const rawRight = Math.max(0, d.startStart + d.startDur + dx);
							const snappedRight = snap(rawRight);
							const newDur = Math.max(0, snappedRight - d.startStart);
							updateMarker(d.id, { durationMs: newDur });
						}
					};
					const onUp: React.PointerEventHandler = (e) => {
						const d = dragRef.current;
						if (d && e.pointerId === d.pointerId) dragRef.current = null;
					};
					return (
						<div
							key={m.id}
							className="absolute h-5 flex items-center"
							style={{ left, top: yOffset }}
							title={m.name || "Marker"}
						>
							{/* body */}
							<button
								type="button"
								className="relative h-5 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] bg-primary/20 hover:bg-primary/30 cursor-grab"
								style={{ width: markerWidth, backgroundColor: m.color }}
								onPointerDown={(e) => onDown(e, "center")}
								onPointerMove={onMove}
								onPointerUp={onUp}
								onDoubleClick={() => setEditingId(m.id)}
								aria-label={m.name || "Marker"}
							>
								<div className="absolute inset-y-1 left-1 right-1 text-[10px] leading-3 text-foreground/90 truncate">
									{editingId === m.id ? (
										<input
											className="w-full h-full bg-background/80 rounded px-1 text-[10px]"
											// biome:allow=suspicious/noFocused
											defaultValue={m.name}
											onBlur={(e) => {
												setEditingId(null);
												updateMarker(m.id, { name: e.currentTarget.value });
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === "Escape") {
													(e.target as HTMLInputElement).blur();
												}
											}}
										/>
									) : (
										m.name || ""
									)}
								</div>
								{/* left handle */}
								<button
									type="button"
									className="absolute inset-y-0 left-0 w-1 cursor-ew-resize bg-black/20"
									onPointerDown={(e) => onDown(e, "left")}
									onPointerMove={onMove}
									onPointerUp={onUp}
									aria-label="Resize marker start"
								/>
								{/* right handle */}
								<button
									type="button"
									className="absolute inset-y-0 right-0 w-1 cursor-ew-resize bg-black/20"
									onPointerDown={(e) => onDown(e, "right")}
									onPointerMove={onMove}
									onPointerUp={onUp}
									aria-label="Resize marker end"
								/>
							</button>
						</div>
					);
				})}
		</div>
	);
}
