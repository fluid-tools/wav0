import { describe, expect, it } from "vitest";
import { playbackAtom, tracksAtom } from "../../state/atoms";
import { updateClipAtom } from "../../state/clips";
import type { Clip, Track } from "../../state/types";
import type { TrackEnvelope } from "../../types/schemas";
import {
	computeAutomationTransfer,
	mergeAutomationPoints,
} from "../automation-migration-helpers";

describe("computeAutomationTransfer", () => {
	const mockEnvelope: TrackEnvelope = {
		enabled: true,
		points: [
			{ id: "p1", time: 100, value: 0.5, clipId: "clip1" },
			{ id: "p2", time: 150, value: 0.7, clipId: "clip1" },
			{ id: "p3", time: 200, value: 0.3, clipId: undefined },
			{ id: "p4", time: 250, value: 0.9, clipId: "clip2" },
		],
		segments: [{ id: "s1", fromPointId: "p1", toPointId: "p2", curve: 0 }],
	};

	it("transfers clip-attached points with correct offset", () => {
		const result = computeAutomationTransfer(
			mockEnvelope,
			"clip1",
			100,
			200,
			300, // +200ms offset
			"clip1",
			1000,
			{ mode: "clip-attached" },
		);

		expect(result.pointsToAdd).toHaveLength(2); // p1, p2
		const [firstPoint, secondPoint] = result.pointsToAdd;
		expect(firstPoint.clipId).toBe("clip1");
		expect(firstPoint.time).toBe(300);
		expect(firstPoint.clipRelativeTime).toBe(0);
		expect(secondPoint.clipId).toBe("clip1");
		expect(secondPoint.time).toBe(350); // 300 + 50ms relative
		expect(secondPoint.clipRelativeTime).toBe(50);
		expect(result.segmentsToAdd).toHaveLength(1);
		expect(result.pointIdsToRemove).toHaveLength(2);
	});

	it("ignores track-level points in clip-attached mode", () => {
		const result = computeAutomationTransfer(
			mockEnvelope,
			"clip1",
			100,
			250,
			0, // -100ms offset
			"clip1",
			1000,
			{ mode: "clip-attached" },
		);

		expect(result.pointsToAdd).toHaveLength(2);
		expect(result.pointsToAdd.every((p) => p.clipId === "clip1")).toBe(true);
		expect(result.pointsToAdd.map((p) => p.time)).toEqual([0, 50]);
	});

	it("clamps points to valid range", () => {
		const result = computeAutomationTransfer(
			mockEnvelope,
			"clip1",
			100,
			200,
			-150, // Would put p1 at -50ms
			"clip1",
			500,
			{ mode: "clip-attached" },
		);

		expect(result.pointsToAdd.map((p) => p.time)).toEqual([0, 0]);
	});

	it("excludes points at end boundary when includeEndBoundary is false", () => {
		const envelopeWithEndPoint: TrackEnvelope = {
			enabled: true,
			points: [
				{ id: "p1", time: 100, value: 0.5, clipId: "clip1" },
				{ id: "p2", time: 200, value: 0.7, clipId: "clip1" }, // Exactly at end
			],
			segments: [],
		};

		const result = computeAutomationTransfer(
			envelopeWithEndPoint,
			"clip1",
			100,
			200,
			300,
			"clip1",
			1000,
			{ mode: "clip-attached", includeEndBoundary: false },
		);

		// Only p1 should be included (p2 is exactly at end boundary)
		expect(result.pointsToAdd).toHaveLength(1);
		expect(result.pointsToAdd[0].id).not.toBe("p2");
	});

	it("includes points at end boundary when includeEndBoundary is true", () => {
		const envelopeWithEndPoint: TrackEnvelope = {
			enabled: true,
			points: [
				{ id: "p1", time: 100, value: 0.5, clipId: "clip1" },
				{ id: "p2", time: 200, value: 0.7, clipId: "clip1" }, // Exactly at end
			],
			segments: [],
		};

		const result = computeAutomationTransfer(
			envelopeWithEndPoint,
			"clip1",
			100,
			200,
			300,
			"clip1",
			1000,
			{ mode: "clip-attached", includeEndBoundary: true },
		);

		// Both p1 and p2 should be included
		expect(result.pointsToAdd).toHaveLength(2);
		expect(result.pointsToAdd.map((p) => p.time)).toEqual([300, 400]);
		expect(result.pointsToAdd.map((p) => p.clipRelativeTime)).toEqual([0, 100]);
	});

	it("only transfers segments when both endpoints are included", () => {
		const envelope: TrackEnvelope = {
			enabled: true,
			points: [
				{ id: "p1", time: 100, value: 0.5, clipId: "clip1" },
				{ id: "p2", time: 150, value: 0.7, clipId: "clip1" },
				{ id: "p3", time: 200, value: 0.3, clipId: "clip1" },
			],
			segments: [
				{ id: "s1", fromPointId: "p1", toPointId: "p2", curve: 0 },
				{ id: "s2", fromPointId: "p2", toPointId: "p3", curve: 5 },
			],
		};

		// Only transfer p1 and p2, not p3
		const result = computeAutomationTransfer(
			envelope,
			"clip1",
			100,
			180, // Excludes p3
			300,
			"clip1",
			1000,
			{ mode: "clip-attached", includeEndBoundary: false },
		);

		expect(result.pointsToAdd).toHaveLength(2); // p1, p2
		expect(result.pointsToAdd.map((p) => p.time)).toEqual([300, 350]);
		// Only s1 should transfer (both endpoints included)
		expect(result.segmentsToAdd).toHaveLength(1);
	});

	it("generates new UUIDs for all points and segments", () => {
		const result = computeAutomationTransfer(
			mockEnvelope,
			"clip1",
			100,
			200,
			300,
			"clip1",
			1000,
			{ mode: "clip-attached" },
		);

		// Ensure all IDs are new
		const oldIds = mockEnvelope.points.map((p) => p.id);
		const newIds = result.pointsToAdd.map((p) => p.id);

		for (const newId of newIds) {
			expect(oldIds).not.toContain(newId);
		}

		// Ensure segments have new IDs and point to new point IDs
		const oldSegmentIds = (mockEnvelope.segments || []).map((s) => s.id);
		for (const newSegment of result.segmentsToAdd) {
			expect(oldSegmentIds).not.toContain(newSegment.id);
			expect(newIds).toContain(newSegment.fromPointId);
			expect(newIds).toContain(newSegment.toPointId);
		}
	});

	it("transfers automation in time-range mode with absolute offsets", () => {
		const rangeEnvelope: TrackEnvelope = {
			enabled: true,
			points: [
				{ id: "p1", time: 400, value: 0.4 },
				{ id: "p2", time: 450, value: 0.6 },
			],
			segments: [{ id: "s1", fromPointId: "p1", toPointId: "p2", curve: 0 }],
		};

		const result = computeAutomationTransfer(
			rangeEnvelope,
			"clip1",
			400,
			500,
			200,
			"clip1",
			800,
			{ mode: "time-range" },
		);

		expect(result.pointsToAdd.map((p) => p.time)).toEqual([200, 250]);
		expect(
			result.pointsToAdd.every(
				(p) => p.clipId === "clip1" || p.clipId === undefined,
			),
		).toBe(true);
		expect(
			result.pointsToAdd.every((p) => p.clipRelativeTime === undefined),
		).toBe(true);
		expect(result.segmentsToAdd).toHaveLength(1);
	});
});

describe("updateClipAtom same-track automation", () => {
	it("keeps track-level automation stationary while moving clip-bound points", async () => {
		const clip: Clip = {
			id: "clip1",
			name: "Test Clip",
			opfsFileId: "file-1",
			startTime: 100,
			trimStart: 0,
			trimEnd: 400,
			sourceDurationMs: 400,
			fadeInCurve: 0,
			fadeOutCurve: 0,
		};

		const track: Track = {
			id: "track1",
			name: "Track 1",
			duration: 1000,
			startTime: 0,
			trimStart: 0,
			trimEnd: 1000,
			muted: false,
			soloed: false,
			color: "#ff0000",
			clips: [clip],
			volumeEnvelope: {
				enabled: true,
				points: [
					{
						id: "clip-point",
						time: 120,
						value: 0.8,
						clipId: "clip1",
						clipRelativeTime: 20,
					},
					{ id: "track-point", time: 300, value: 1.2 },
				],
				segments: [],
			},
		};

		let tracksState: Track[] = [track];
		const playbackState = {
			isPlaying: false,
			currentTime: 0,
			duration: 0,
			bpm: 120,
			looping: false,
		};

		const mockGet = (atomRef: unknown) => {
			if (atomRef === tracksAtom) return tracksState;
			if (atomRef === playbackAtom) return playbackState;
			throw new Error("Unexpected atom read");
		};

		const mockSet = (atomRef: unknown, value: unknown) => {
			if (atomRef === tracksAtom) {
				tracksState = value as Track[];
				return;
			}
			throw new Error("Unexpected atom write");
		};

		await updateClipAtom.write(mockGet, mockSet, "track1", "clip1", {
			startTime: 400,
		});

		const updatedTrack = tracksState[0];
		const updatedClip = updatedTrack.clips?.[0];
		expect(updatedClip?.startTime).toBe(400);

		const clipPoint = updatedTrack.volumeEnvelope?.points.find(
			(point) => point.id === "clip-point",
		);
		expect(clipPoint?.time).toBe(420);
		expect(clipPoint?.clipRelativeTime).toBe(20);

		const trackPoint = updatedTrack.volumeEnvelope?.points.find(
			(point) => point.id === "track-point",
		);
		expect(trackPoint?.time).toBe(300);
	});
});

describe("mergeAutomationPoints", () => {
	it("deduplicates points within epsilon", () => {
		const existing = [
			{ id: "e1", time: 100, value: 0.5, clipId: "c1" },
			{ id: "e2", time: 200, value: 0.7, clipId: "c1" },
		];

		const newPoints = [
			{ id: "n1", time: 100.2, value: 0.6, clipId: "c1" }, // Duplicate (within 0.5ms)
			{ id: "n2", time: 150, value: 0.8, clipId: "c1" }, // New
		];

		const merged = mergeAutomationPoints(existing, newPoints, 0.5);

		expect(merged).toHaveLength(3); // e1, n2, e2 (sorted)
		expect(merged.find((p) => p.id === "e1")).toBeDefined();
		expect(merged.find((p) => p.id === "e2")).toBeDefined();
		expect(merged.find((p) => p.id === "n2")).toBeDefined();
		expect(merged.find((p) => p.id === "n1")).toBeUndefined(); // Duplicate dropped
	});

	it("keeps points sorted by time", () => {
		const existing = [
			{ id: "e1", time: 100, value: 0.5, clipId: "c1" },
			{ id: "e2", time: 300, value: 0.7, clipId: "c1" },
		];

		const newPoints = [
			{ id: "n1", time: 200, value: 0.6, clipId: "c1" },
			{ id: "n2", time: 400, value: 0.8, clipId: "c1" },
		];

		const merged = mergeAutomationPoints(existing, newPoints);

		// Should be sorted: 100, 200, 300, 400
		expect(merged.map((p) => p.time)).toEqual([100, 200, 300, 400]);
	});

	it("handles empty arrays", () => {
		const merged1 = mergeAutomationPoints([], []);
		expect(merged1).toEqual([]);

		const existing = [{ id: "e1", time: 100, value: 0.5, clipId: "c1" }];
		const merged2 = mergeAutomationPoints(existing, []);
		expect(merged2).toEqual(existing);

		const newPoints = [{ id: "n1", time: 200, value: 0.6, clipId: "c1" }];
		const merged3 = mergeAutomationPoints([], newPoints);
		expect(merged3).toHaveLength(1);
	});

	it("uses custom epsilon value", () => {
		const existing = [{ id: "e1", time: 100, value: 0.5, clipId: "c1" }];
		const newPoints = [{ id: "n1", time: 100.4, value: 0.6, clipId: "c1" }]; // 0.4ms apart

		// With epsilon 0.5ms, values land in separate buckets
		const merged1 = mergeAutomationPoints(existing, newPoints, 0.5);
		expect(merged1).toHaveLength(2);

		// With epsilon 2ms, should be considered duplicate
		const merged2 = mergeAutomationPoints(existing, newPoints, 2);
		expect(merged2).toHaveLength(1);

		// With very small epsilon, should be separate
		const merged3 = mergeAutomationPoints(existing, newPoints, 0.1);
		expect(merged3).toHaveLength(2);
	});
});
