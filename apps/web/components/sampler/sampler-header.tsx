"use client";

import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { memo } from "react";

type SamplerHeaderProps = {
	onStopAll: () => void;
};

/**
 * Sampler header with transport controls and settings
 */
export const SamplerHeader = memo(function SamplerHeader({
	onStopAll,
}: SamplerHeaderProps) {
	return (
		<header className="flex h-14 items-center justify-between border-b bg-card px-4">
			{/* Left: Title */}
			<div className="flex items-center gap-4">
				<h1 className="text-lg font-semibold">Sampler</h1>
				<span className="text-xs text-muted-foreground">
					Press keys to trigger pads
				</span>
			</div>

			{/* Center: Keyboard legend */}
			<div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
				<kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
					1-4
				</kbd>
				<kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
					QWER
				</kbd>
				<kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
					ASDF
				</kbd>
				<kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">
					ZXCV
				</kbd>
			</div>

			{/* Right: Controls */}
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" onClick={onStopAll} className="gap-2">
					<Square className="size-4" />
					<span className="hidden sm:inline">Stop All</span>
				</Button>
			</div>
		</header>
	);
});
