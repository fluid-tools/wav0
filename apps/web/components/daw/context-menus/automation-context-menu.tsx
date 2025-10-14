"use client";

import { useAtom } from "jotai";
import { useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type {
	Track,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "@/lib/daw-sdk";
import {
	addAutomationPoint,
	removeAutomationPoint,
	updateSegmentCurve,
	updateTrackAtom,
} from "@/lib/daw-sdk";

type AutomationContextMenuProps = {
	track: Track;
	trackHeight: number;
	pxPerMs: number;
	onAddPoint?: (point: TrackEnvelopePoint) => void;
	children: React.ReactNode;
};

export function AutomationContextMenu({
	track,
	trackHeight,
	pxPerMs,
	onAddPoint,
	children,
}: AutomationContextMenuProps) {
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [contextMenuState, setContextMenuState] = useState<{
		x: number;
		y: number;
		clientX: number;
		clientY: number;
	} | null>(null);
	const [copiedAutomation, setCopiedAutomation] = useState<{
		points: TrackEnvelopePoint[];
		segments: TrackEnvelopeSegment[];
	} | null>(null);

	const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setContextMenuState({ x, y, clientX: e.clientX, clientY: e.clientY });
	};

	const handleAddPoint = () => {
		if (!contextMenuState || !track.volumeEnvelope) return;

		const time = contextMenuState.x / pxPerMs;
		const padding = 20;
		const usableHeight = trackHeight - padding * 2;
		const normalizedY =
			(trackHeight - padding - contextMenuState.y) / usableHeight;
		const value = Math.max(0, Math.min(4, normalizedY * 4));

		const newPoint: TrackEnvelopePoint = {
			id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
			time,
			value,
		};

		const updatedEnvelope = addAutomationPoint(track.volumeEnvelope, newPoint);

		updateTrack(track.id, {
			volumeEnvelope: updatedEnvelope,
		});

		onAddPoint?.(newPoint);
	};

	const handleDeletePoint = () => {
		if (!contextMenuState || !track.volumeEnvelope) return;

		// Find point near cursor
		const time = contextMenuState.x / pxPerMs;
		const nearestPoint = track.volumeEnvelope.points.reduce(
			(nearest, point) => {
				const dist = Math.abs(point.time - time);
				return dist < nearest.dist ? { point, dist } : nearest;
			},
			{ point: null as TrackEnvelopePoint | null, dist: Infinity },
		);

		if (nearestPoint.point && nearestPoint.dist < 100) {
			const updatedEnvelope = removeAutomationPoint(
				track.volumeEnvelope,
				nearestPoint.point.id,
			);

			updateTrack(track.id, {
				volumeEnvelope: updatedEnvelope,
			});
		}
	};

	const handleResetSegmentCurve = () => {
		if (!contextMenuState || !track.volumeEnvelope) return;

		const time = contextMenuState.x / pxPerMs;
		const sorted = [...track.volumeEnvelope.points].sort(
			(a, b) => a.time - b.time,
		);

		// Find segment at cursor
		for (let i = 0; i < sorted.length - 1; i++) {
			const p1 = sorted[i];
			const p2 = sorted[i + 1];

			if (time >= p1.time && time <= p2.time) {
				const segment = track.volumeEnvelope.segments?.find(
					(s) => s.fromPointId === p1.id && s.toPointId === p2.id,
				);

				if (segment) {
					const updatedEnvelope = updateSegmentCurve(
						track.volumeEnvelope,
						segment.id,
						0,
					);

					updateTrack(track.id, {
						volumeEnvelope: updatedEnvelope,
					});
				}
				break;
			}
		}
	};

	const handleCopyAutomation = () => {
		if (!track.volumeEnvelope) return;

		setCopiedAutomation({
			points: track.volumeEnvelope.points,
			segments: track.volumeEnvelope.segments || [],
		});
	};

	const handlePasteAutomation = () => {
		if (!copiedAutomation || !contextMenuState) return;

		const offset = contextMenuState.x / pxPerMs;
		const minTime = Math.min(...copiedAutomation.points.map((p) => p.time));

		// Shift all points by offset
		const newPoints = copiedAutomation.points.map((p) => ({
			...p,
			id: crypto.randomUUID(),
			time: p.time - minTime + offset,
		}));

		updateTrack(track.id, {
			volumeEnvelope: {
				enabled: true,
				points: [...(track.volumeEnvelope?.points || []), ...newPoints],
				segments: [...(track.volumeEnvelope?.segments || [])],
			},
		});
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Context menu trigger wrapper */}
				<div onContextMenu={handleContextMenu}>{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-56" alignOffset={-4}>
				<ContextMenuItem onClick={handleAddPoint}>
					Add Point at Cursor
				</ContextMenuItem>
				<ContextMenuItem onClick={handleDeletePoint}>
					Delete Nearest Point
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleResetSegmentCurve}>
					Reset Segment Curve
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={handleCopyAutomation}>
					Copy Automation
				</ContextMenuItem>
				<ContextMenuItem
					onClick={handlePasteAutomation}
					disabled={!copiedAutomation}
				>
					Paste Automation
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
