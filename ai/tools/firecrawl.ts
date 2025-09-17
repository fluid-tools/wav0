import "server-only";

import "dotenv/config";
import FirecrawlApp from "@mendable/firecrawl-js";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

export const webSearch = tool({
	description: "Search the web for up-to-date information",
	inputSchema: z.object({
		urlToCrawl: z
			.string()
			.url()
			.min(1)
			.max(100)
			.describe("The URL to crawl (including http:// or https://)"),
	}),
	execute: async ({ urlToCrawl }) => {
		const crawlResponse = await app.crawl(urlToCrawl, {
			limit: 1,
			scrapeOptions: {
				formats: ["markdown", "html"],
			},
		});
		if (crawlResponse.status === "failed") {
			throw new Error(`STATUS: ${crawlResponse.status}`);
		}
		return crawlResponse.data;
	},
});

const main = async () => {
	const { text } = await generateText({
		model: "openai/gpt-5-mini", // can be any model that supports tools
		prompt: "Get the latest blog post from vercel.com/blog",
		tools: {
			webSearch,
		},
		stopWhen: stepCountIs(5),
	});
	console.log(text);
};

main();
