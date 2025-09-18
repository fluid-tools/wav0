"use client";

import { useAtom } from "jotai";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timelineWidthAtom } from "@/lib/state/daw-store";
import { DAWControls } from "./daw-controls";
import { DAWTimeline } from "./daw-timeline";
import { DAWToolbar } from "./daw-toolbar";
import { DAWTrackContent } from "./daw-track-content";
import { DAWTrackList } from "./daw-track-list";

export function DAWContainer() {
	const [timelineWidth] = useAtom(timelineWidthAtom);

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Toolbar */}
			<DAWToolbar />

			{/* Main DAW Interface */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Transport Controls */}
				<DAWControls />

				{/* Timeline + Tracks */}
				<div className="flex-1 flex overflow-hidden">
					<ResizablePanelGroup direction="horizontal" className="h-full">
						{/* Track List Panel */}
						<ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
							<div className="h-full border-r">
								<DAWTrackList />
							</div>
						</ResizablePanel>

						<ResizableHandle />

						{/* Timeline Panel */}
						<ResizablePanel defaultSize={75}>
							<div className="h-full flex flex-col">
								{/* Timeline Header */}
								<div className="h-16 border-b">
									<ScrollArea
										className="h-full"
										style={{
											scrollbarWidth: "none",
											msOverflowStyle: "none",
										}}
									>
										<div className="h-full" style={{ width: timelineWidth }}>
											<DAWTimeline />
										</div>
									</ScrollArea>
								</div>

								{/* Track Content Area */}
								<div className="flex-1 overflow-hidden">
									<ScrollArea className="h-full w-full">
										<div
											className="h-full min-h-96"
											style={{ width: timelineWidth }}
										>
											<DAWTrackContent />
										</div>
									</ScrollArea>
								</div>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
}
