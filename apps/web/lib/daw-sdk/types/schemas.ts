import { z } from "zod";

// ===== Core Type Schemas =====

export const CurveTypeSchema = z.enum([
	"linear",
	"easeIn",
	"easeOut",
	"sCurve",
]);

// Automation segment - owns curve between two points (Logic Pro style)
export const TrackEnvelopeSegmentSchema = z.object({
	id: z.string(),
	fromPointId: z.string(),
	toPointId: z.string(),
	curve: z.number().min(-99).max(99).default(0), // -99 to +99, 0 = linear
});

export const TrackEnvelopePointSchema = z.object({
	id: z.string(),
	time: z.number().min(0), // milliseconds (absolute for track-level, or resolved from clip-relative)
	value: z.number().min(0).max(4), // gain multiplier
	// Curve removed - now stored on segments between points
	clipId: z.string().optional(), // optional clip binding for clip-relative automation
	clipRelativeTime: z.number().optional(), // time relative to clip start (when clipId is set)
});

export const TrackEnvelopeSchema = z.object({
	enabled: z.boolean(),
	points: z.array(TrackEnvelopePointSchema),
	segments: z.array(TrackEnvelopeSegmentSchema).default([]), // NEW: segments own curves
});

export const ClipSchema = z.object({
	id: z.string(),
	name: z.string(),
	opfsFileId: z.string(),
	audioFileName: z.string().optional(),
	audioFileType: z.string().optional(),
	startTime: z.number().min(0), // milliseconds
	trimStart: z.number().min(0), // milliseconds
	trimEnd: z.number().min(0), // milliseconds
	sourceDurationMs: z.number().min(0),
	fadeIn: z.number().min(0).max(120_000).optional(), // max 2 minutes
	fadeOut: z.number().min(0).max(120_000).optional(),
	fadeInCurve: z.number().min(-99).max(99).default(0), // -99 (exponential/fast) to +99 (logarithmic/slow), 0 = linear
	fadeOutCurve: z.number().min(-99).max(99).default(0), // -99 (exponential/fast) to +99 (logarithmic/slow), 0 = linear
	loop: z.boolean().optional(),
	loopEnd: z.number().min(0).optional(),
	color: z.string().optional(),
});

export const TrackSchema = z.object({
	id: z.string(),
	name: z.string(),
	audioUrl: z.string().optional(),
	audioBuffer: z.instanceof(ArrayBuffer).optional(),
	duration: z.number().min(0),
	startTime: z.number().min(0),
	trimStart: z.number().min(0),
	trimEnd: z.number().min(0),
	// Volume in dB (pure dB system like Logic Pro)
	volumeDb: z.number().min(Number.NEGATIVE_INFINITY).max(6).optional(),
	// Legacy volume percentage (0-100) - kept for backward compatibility
	volume: z.number().min(0).max(100).optional(),
	muted: z.boolean(),
	soloed: z.boolean(),
	color: z.string(),
	opfsFileId: z.string().optional(),
	audioFileName: z.string().optional(),
	audioFileType: z.string().optional(),
	clips: z.array(ClipSchema).optional(),
	volumeEnvelope: TrackEnvelopeSchema.optional(),
	schemaVersion: z.number().optional(), // Track schema version for migration
});

export const PlaybackStateSchema = z.object({
	isPlaying: z.boolean(),
	currentTime: z.number().min(0),
	duration: z.number().min(0),
	bpm: z.number().min(30).max(300),
	looping: z.boolean(),
});

export const TimelineStateSchema = z.object({
	zoom: z.number().min(0.05).max(5),
	scrollPosition: z.number().min(0),
	snapToGrid: z.boolean(),
	gridSize: z.number().min(0),
	snapGranularity: z
		.enum(["coarse", "medium", "fine", "custom"])
		.default("medium"),
	customSnapIntervalMs: z.number().min(0).optional(),
});

export const TimelineSectionSchema = z.object({
	id: z.string(),
	name: z.string(),
	startTime: z.number().min(0),
	endTime: z.number().min(0),
	color: z.string(),
});

// Project marker (named cue on the timeline)
export const ProjectMarkerSchema = z.object({
	id: z.string(),
	timeMs: z.number().min(0),
	name: z.string().default(""),
	color: z.string().default("#ffffff"),
	durationMs: z.number().min(0).optional(),
});

export const ToolSchema = z.enum(["pointer", "trim", "razor"]);

export const AutomationTypeSchema = z.enum(["volume", "pan"]);

export const ClipInspectorTargetSchema = z
	.object({
		trackId: z.string(),
		clipId: z.string(),
	})
	.nullable();

// ===== Audio File Info =====

export const AudioFileInfoSchema = z.object({
	duration: z.number().min(0),
	sampleRate: z.number().positive(),
	numberOfChannels: z.number().int().positive(),
	codec: z.string().nullable(),
	fileName: z.string(),
	fileType: z.string(),
});

// ===== Playback Options =====

export const PlaybackOptionsSchema = z.object({
	startTime: z.number().min(0).optional(),
});

// ===== Type Exports =====

export type TrackEnvelopeSegment = z.infer<typeof TrackEnvelopeSegmentSchema>;
export type TrackEnvelopePoint = z.infer<typeof TrackEnvelopePointSchema>;
export type TrackEnvelope = z.infer<typeof TrackEnvelopeSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;
export type TimelineState = z.infer<typeof TimelineStateSchema>;
export type TimelineSection = z.infer<typeof TimelineSectionSchema>;
export type ProjectMarker = z.infer<typeof ProjectMarkerSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type AutomationType = z.infer<typeof AutomationTypeSchema>;
export type ClipInspectorTarget = z.infer<typeof ClipInspectorTargetSchema>;
export type AudioFileInfo = z.infer<typeof AudioFileInfoSchema>;

// Manual type for PlaybackOptions (callbacks can't be validated with Zod reliably)
export type PlaybackOptions = {
	startTime?: number;
	onTimeUpdate?: (time: number) => void;
	onPlaybackEnd?: () => void;
};
