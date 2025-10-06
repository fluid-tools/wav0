import { z } from "zod";

// ===== Core Type Schemas =====

export const CurveTypeSchema = z.enum([
	"linear",
	"easeIn",
	"easeOut",
	"sCurve",
]);

export const TrackEnvelopePointSchema = z.object({
	id: z.string(),
	time: z.number().min(0), // milliseconds
	value: z.number().min(0).max(4), // gain multiplier
	curve: CurveTypeSchema.optional(),
	curveShape: z.number().min(0).max(1).optional(), // 0-1 curve parameter
});

export const TrackEnvelopeSchema = z.object({
	enabled: z.boolean(),
	points: z.array(TrackEnvelopePointSchema),
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
	fadeInCurve: CurveTypeSchema.optional(),
	fadeOutCurve: CurveTypeSchema.optional(),
	fadeInShape: z.number().min(0).max(1).optional(),
	fadeOutShape: z.number().min(0).max(1).optional(),
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
	volume: z.number().min(0).max(100),
	muted: z.boolean(),
	soloed: z.boolean(),
	color: z.string(),
	opfsFileId: z.string().optional(),
	audioFileName: z.string().optional(),
	audioFileType: z.string().optional(),
	clips: z.array(ClipSchema).optional(),
	volumeEnvelope: TrackEnvelopeSchema.optional(),
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
});

export const TimelineSectionSchema = z.object({
	id: z.string(),
	name: z.string(),
	startTime: z.number().min(0),
	endTime: z.number().min(0),
	color: z.string(),
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

export type CurveType = z.infer<typeof CurveTypeSchema>;
export type TrackEnvelopePoint = z.infer<typeof TrackEnvelopePointSchema>;
export type TrackEnvelope = z.infer<typeof TrackEnvelopeSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;
export type TimelineState = z.infer<typeof TimelineStateSchema>;
export type TimelineSection = z.infer<typeof TimelineSectionSchema>;
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
