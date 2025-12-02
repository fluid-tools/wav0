"use client";

import { updateTrackAtom } from "@wav0/daw-react";
import type {
	Track,
	TrackEnvelopePoint,
	TrackEnvelopeSegment,
} from "@wav0/daw-sdk";
import { automation } from "@wav0/daw-sdk";
import { useAtom } from "jotai";
import { useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	addAutomationPoint,
	removeAutomationPoint,
	updateSegmentCurve,
} from "@/lib/daw-sdk";

const { resolveClipRelativePoint } = automation;

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

		// NOTE: Do NOT add scrollLeft - getBoundingClientRect() already accounts for scroll
		// (rect.left becomes negative when scrolled), so contextMenuState.x is already absolute
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

		// NOTE: Do NOT add scrollLeft - getBoundingClientRect() already accounts for scroll
		const time = contextMenuState.x / pxPerMs;

		// Resolve clip-relative points to absolute time before comparison
		const resolvedPoints = track.volumeEnvelope.points.map((point) => {
			const clip = track.clips?.find((c) => c.id === point.clipId);
			return clip ? resolveClipRelativePoint(point, clip.startTime) : point;
		});

		const nearestPoint = resolvedPoints.reduce(
			(nearest, point) => {
				const dist = Math.abs(point.time - time);
				return dist < nearest.dist ? { point, dist } : nearest;
			},
			{ point: null as TrackEnvelopePoint | null, dist: Infinity },
		);

		// Use original point ID since resolved points maintain IDs
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

	/**
	 * Set segment curve at cursor to the given value
	 * @param curveValue -99 to +99 (negative = ease in, positive = ease out, 0 = linear)
	 */
	const handleSetSegmentCurve = (curveValue: number) => {
		if (!contextMenuState || !track.volumeEnvelope) return;

		// NOTE: Do NOT add scrollLeft - getBoundingClientRect() already accounts for scroll
		const time = contextMenuState.x / pxPerMs;

		// Resolve clip-relative points to absolute time, then sort by time.
		// Segments are defined between time-adjacent points (see generateSegmentsFromPoints),
		// so we must iterate in time order to match segment definitions.
		const resolvedPoints = track.volumeEnvelope.points
			.map((point) => {
				const clip = track.clips?.find((c) => c.id === point.clipId);
				return clip ? resolveClipRelativePoint(point, clip.startTime) : point;
			})
			.sort((a, b) => a.time - b.time);

		// Find segment at cursor (time-sorted order matches segment fromPointId -> toPointId)
		for (let i = 0; i < resolvedPoints.length - 1; i++) {
			const p1 = resolvedPoints[i];
			const p2 = resolvedPoints[i + 1];

			if (time >= p1.time && time <= p2.time) {
				const segment = track.volumeEnvelope.segments?.find(
					(s) => s.fromPointId === p1.id && s.toPointId === p2.id,
				);

				if (segment) {
					const updatedEnvelope = updateSegmentCurve(
						track.volumeEnvelope,
						segment.id,
						curveValue,
					);

					updateTrack(track.id, {
						volumeEnvelope: updatedEnvelope,
					});
				}
				break;
			}
		}
	};

	const handleResetSegmentCurve = () => handleSetSegmentCurve(0);

	const handleCopyAutomation = () => {
		if (!track.volumeEnvelope) return;

		// Resolve clip-relative points to absolute time for copy
		const resolvedPoints = track.volumeEnvelope.points.map((point) => {
			const clip = track.clips?.find((c) => c.id === point.clipId);
			const resolved = clip
				? resolveClipRelativePoint(point, clip.startTime)
				: point;
			// Strip clip binding - copied points become track-level
			const { clipId: _, clipRelativeTime: __, ...rest } = resolved;
			return rest;
		});

		setCopiedAutomation({
			points: resolvedPoints,
			segments: track.volumeEnvelope.segments || [],
		});
	};

	const handlePasteAutomation = () => {
		if (!copiedAutomation || !contextMenuState) return;
		if (copiedAutomation.points.length === 0) return;

		// NOTE: Do NOT add scrollLeft - getBoundingClientRect() already accounts for scroll
		const offset = contextMenuState.x / pxPerMs;
		const minTime = Math.min(...copiedAutomation.points.map((p) => p.time));

		// Create mapping from old point IDs to new point IDs
		const idMap = new Map<string, string>();

		// Shift all points by offset and generate new IDs
		const newPoints = copiedAutomation.points.map((p) => {
			const newId = crypto.randomUUID();
			idMap.set(p.id, newId);
			return {
				...p,
				id: newId,
				time: p.time - minTime + offset,
			};
		});

		// Copy segments and remap point IDs
		const newSegments = copiedAutomation.segments
			.filter((seg) => idMap.has(seg.fromPointId) && idMap.has(seg.toPointId))
			.map((seg) => {
				const fromId = idMap.get(seg.fromPointId);
				const toId = idMap.get(seg.toPointId);
				// IDs guaranteed to exist due to filter above
				if (!fromId || !toId) throw new Error("Segment point ID not found");
				return {
					...seg,
					id: crypto.randomUUID(),
					fromPointId: fromId,
					toPointId: toId,
				};
			});

		updateTrack(track.id, {
			volumeEnvelope: {
				enabled: true,
				points: [...(track.volumeEnvelope?.points || []), ...newPoints].sort(
					(a, b) => a.time - b.time,
				),
				segments: [...(track.volumeEnvelope?.segments || []), ...newSegments],
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
					Linear (Reset Curve)
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleSetSegmentCurve(-50)}>
					Ease In
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleSetSegmentCurve(50)}>
					Ease Out
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleSetSegmentCurve(-75)}>
					Strong Ease In
				</ContextMenuItem>
				<ContextMenuItem onClick={() => handleSetSegmentCurve(75)}>
					Strong Ease Out
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
