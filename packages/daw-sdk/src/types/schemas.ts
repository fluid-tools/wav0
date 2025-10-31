/**
 * Type Schemas with Zod validation
 * Domain models for tracks, clips, automation, and playback
 */

import { z } from "zod";

// ===== Curve Types =====

export const CurveTypeSchema = z.enum([
	"linear",
	"easeIn",
	"easeOut",
	"sCurve",
]);

export type CurveType = z.infer<typeof CurveTypeSchema>;

// ===== Automation =====

export const TrackEnvelopeSegmentSchema = z.object({
	id: z.string(),
	fromPointId: z.string(),
	toPointId: z.string(),
	curve: z.number().min(-99).max(99).default(0),
});

export const TrackEnvelopePointSchema = z.object({
	id: z.string(),
	time: z.number().min(0),
	value: z.number().min(0).max(4),
	clipId: z.string().optional(),
	clipRelativeTime: z.number().optional(),
});

export const TrackEnvelopeSchema = z.object({
	enabled: z.boolean(),
	points: z.array(TrackEnvelopePointSchema),
	segments: z.array(TrackEnvelopeSegmentSchema).default([]),
});

export type TrackEnvelopeSegment = z.infer<typeof TrackEnvelopeSegmentSchema>;
export type TrackEnvelopePoint = z.infer<typeof TrackEnvelopePointSchema>;
export type TrackEnvelope = z.infer<typeof TrackEnvelopeSchema>;

// ===== Clips =====

export const ClipSchema = z.object({
	id: z.string(),
	name: z.string(),
	opfsFileId: z.string(),
	audioFileName: z.string().optional(),
	audioFileType: z.string().optional(),
	startTime: z.number().min(0),
	trimStart: z.number().min(0),
	trimEnd: z.number().min(0),
	sourceDurationMs: z.number().min(0),
	fadeIn: z.number().min(0).max(120_000).optional(),
	fadeOut: z.number().min(0).max(120_000).optional(),
	fadeInCurve: z.number().min(-99).max(99).default(0),
	fadeOutCurve: z.number().min(-99).max(99).default(0),
	loop: z.boolean().optional(),
	loopEnd: z.number().min(0).optional(),
	color: z.string().optional(),
});

export type Clip = z.infer<typeof ClipSchema>;

// ===== Tracks =====

export const TrackSchema = z.object({
	id: z.string(),
	name: z.string(),
	audioUrl: z.string().optional(),
	audioBuffer: z.instanceof(ArrayBuffer).optional(),
	duration: z.number().min(0),
	startTime: z.number().min(0),
	trimStart: z.number().min(0),
	trimEnd: z.number().min(0),
	volumeDb: z.number().min(Number.NEGATIVE_INFINITY).max(6).optional(),
	volume: z.number().min(0).max(100).optional(),
	muted: z.boolean(),
	soloed: z.boolean(),
	color: z.string(),
	opfsFileId: z.string().optional(),
	audioFileName: z.string().optional(),
	audioFileType: z.string().optional(),
	clips: z.array(ClipSchema).optional(),
	volumeEnvelope: TrackEnvelopeSchema.optional(),
	schemaVersion: z.number().optional(),
});

export type Track = z.infer<typeof TrackSchema>;

// ===== Playback =====

export const PlaybackStateSchema = z.object({
	isPlaying: z.boolean(),
	currentTime: z.number().min(0),
	duration: z.number().min(0),
	bpm: z.number().min(30).max(300),
	looping: z.boolean(),
});

export type PlaybackState = z.infer<typeof PlaybackStateSchema>;

// ===== Timeline =====

export const TimelineStateSchema = z.object({
	zoom: z.number().min(0.05).max(5),
	scrollPosition: z.number().min(0),
	snapToGrid: z.boolean(),
	gridSize: z.number().min(0),
});

export type TimelineState = z.infer<typeof TimelineStateSchema>;

export const TimelineSectionSchema = z.object({
	id: z.string(),
	name: z.string(),
	startTime: z.number().min(0),
	endTime: z.number().min(0),
	color: z.string(),
});

export type TimelineSection = z.infer<typeof TimelineSectionSchema>;

export const ProjectMarkerSchema = z.object({
	id: z.string(),
	timeMs: z.number().min(0),
	name: z.string().default(""),
	color: z.string().default("#ffffff"),
	durationMs: z.number().min(0).optional(),
});

export type ProjectMarker = z.infer<typeof ProjectMarkerSchema>;

// ===== Audio File Info =====

export const AudioFileInfoSchema = z.object({
	duration: z.number().min(0),
	sampleRate: z.number().positive(),
	numberOfChannels: z.number().int().positive(),
	codec: z.string().nullable(),
	fileName: z.string(),
	fileType: z.string(),
});

export type AudioFileInfo = z.infer<typeof AudioFileInfoSchema>;

// ===== Playback Options =====

export type PlaybackOptions = {
	startTime?: number;
	onTimeUpdate?: (time: number) => void;
	onPlaybackEnd?: () => void;
};

export const AutomationTypeSchema = z.enum(["volume", "pan"]);
export type AutomationType = z.infer<typeof AutomationTypeSchema>;

export const ToolSchema = z.enum(["pointer", "trim", "razor"]);
export type Tool = z.infer<typeof ToolSchema>;

export const ClipInspectorTargetSchema = z
	.object({
		trackId: z.string(),
		clipId: z.string(),
	})
	.nullable();
export type ClipInspectorTarget = z.infer<typeof ClipInspectorTargetSchema>;
