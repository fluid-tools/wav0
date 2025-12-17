import { action } from "./_generated/server";
import { v } from "convex/values";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * Fetch and organize voices by category
 * Returns voices grouped by their category from ElevenLabs API
 */
export const getVoicesByCategory = action(async () => {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

	const client = new ElevenLabsClient({ apiKey });

	// Fetch all voices with pagination
	const allVoices = [];
	let nextPageToken: string | null | undefined;

	do {
		const response = await client.voices.search({
			pageSize: 100,
			...(nextPageToken ? { nextPageToken } : {}),
		});

		allVoices.push(...response.voices);
		nextPageToken = response.nextPageToken;
	} while (nextPageToken);

	// Group by category
	const voicesByCategory = allVoices.reduce(
		(acc, voice) => {
			const category = voice.category || "other";
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push({
				id: voice.voiceId,
				name: voice.name,
				category: voice.category,
				description: voice.description,
				previewUrl: voice.previewUrl,
				labels: voice.labels,
			});
			return acc;
		},
		{} as Record<
			string,
			Array<{
				id: string;
				name: string | null | undefined;
				category: string | null | undefined;
				description: string | null | undefined;
				previewUrl: string | null | undefined;
				labels: Record<string, string> | null | undefined;
			}>
		>,
	);

	return voicesByCategory;
});

/**
 * Search voices by query
 * Returns filtered voices matching the search term
 */
export const searchVoices = action(async (_, { query }: { query: string }) => {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

	const client = new ElevenLabsClient({ apiKey });

	const response = await client.voices.search({
		search: query,
		pageSize: 50,
	});

	return response.voices.map((voice) => ({
		id: voice.voiceId,
		name: voice.name,
		category: voice.category,
		description: voice.description,
		previewUrl: voice.previewUrl,
		labels: voice.labels,
	}));
});

/**
 * Get a specific voice by ID
 */
export const getVoice = action(async (_, { voiceId }: { voiceId: string }) => {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

	const client = new ElevenLabsClient({ apiKey });
	const voice = await client.voices.get(voiceId);

	return {
		id: voice.voiceId,
		name: voice.name,
		category: voice.category,
		description: voice.description,
		previewUrl: voice.previewUrl,
		labels: voice.labels,
		settings: voice.settings,
		samples: voice.samples,
	};
});
