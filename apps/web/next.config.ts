/** @type {import('next').NextConfig} */

import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = withBotId({
	typedRoutes: true,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.vercel-storage.com",
			},
			{
				protocol: "https",
				hostname: "**.googleusercontent.com",
			},
			// youtube
			{
				protocol: "https",
				hostname: "**.youtube.com",
			},
			{
				protocol: "https",
				hostname: "**.ytimg.com",
			},
			// pbs.twimg.com
			{
				protocol: "https",
				hostname: "**.pbs.twimg.com",
			},
			{
				protocol: "https",
				hostname: "**.wav0.app",
			},
			{
				protocol: "https",
				hostname: "**.s3.us-east-1.amazonaws.com",
			},
		],
	},
	redirects: async () => {
		return [
			{
				source: "/discord",
				destination: "https://discord.gg/txUhHEXHs9",
				permanent: false,
			},
		];
	},
	//   skipTrailingSlashRedirect: true,
});

export default nextConfig;
