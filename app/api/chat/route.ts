import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	type UIMessage,
} from "ai";
import { webSearch as firecrawlTool } from "@/ai/tools/firecrawl";

export async function POST(req: Request) {
	const {
		messages,
		model,
		webSearch,
		useFirecrawl,
	}: {
		messages: UIMessage[];
		model: string;
		webSearch: boolean;
		useFirecrawl?: boolean;
	} = await req.json();

	let selectedModel = model;
	let tools: Record<string, typeof firecrawlTool> | undefined;

	// Determine model and tools based on search preference
	if (useFirecrawl) {
		selectedModel = "openai/gpt-5-nano";
		tools = { webSearch: firecrawlTool };
	} else if (webSearch) {
		selectedModel = "perplexity/sonar";
	}

	const result = streamText({
		model: selectedModel,
		messages: convertToModelMessages(messages),
		system:
			"You are a helpful assistant that can answer questions and help with tasks",
		...(tools && { tools }),
		stopWhen: stepCountIs(5),
	});

	// send sources and reasoning back to the client
	return result.toUIMessageStreamResponse({
		sendSources: true,
		sendReasoning: true,
	});
}
