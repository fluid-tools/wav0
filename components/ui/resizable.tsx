"use client";

import * as React from "react";
import {
	Panel,
	PanelGroup,
	type PanelGroupProps,
	type PanelProps,
	PanelResizeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

export const ResizablePanelGroup = React.forwardRef<
	HTMLDivElement,
	PanelGroupProps
>(function ResizablePanelGroup({ className, ...props }, ref) {
	return (
		<PanelGroup
			ref={ref}
			className={cn("flex h-full w-full", className)}
			{...props}
		/>
	);
});

export const ResizablePanel = Panel as React.FC<PanelProps>;

type ResizableHandleProps = React.ComponentProps<typeof PanelResizeHandle> & {
	withHandle?: boolean;
};

export function ResizableHandle({
	withHandle = false,
	className,
	...props
}: ResizableHandleProps) {
	return (
		<PanelResizeHandle
			className={cn(
				"relative flex w-2 items-center justify-center bg-transparent hover:bg-border/40 transition-colors",
				className,
			)}
			{...props}
		>
			{withHandle ? (
				<div className="h-6 w-1 rounded bg-border" />
			) : (
				<div className="absolute inset-y-0 left-1/2 -ml-0.5 w-px bg-border" />
			)}
		</PanelResizeHandle>
	);
}
