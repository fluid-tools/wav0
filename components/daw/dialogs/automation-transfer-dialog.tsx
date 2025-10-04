"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export type AutomationTransferDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: (transferAutomation: boolean) => void;
	clipName: string;
	sourceTrackName: string;
	targetTrackName: string;
	automationPointCount: number;
};

/**
 * Dialog to confirm automation data transfer when moving clips between tracks
 * Follows production DAW patterns (Logic Pro, Ableton)
 */
export function AutomationTransferDialog({
	open,
	onOpenChange,
	onConfirm,
	clipName,
	sourceTrackName,
	targetTrackName,
	automationPointCount,
}: AutomationTransferDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Move Automation Data?</DialogTitle>
					<DialogDescription className="space-y-3 pt-2">
						<p>
							You're moving <span className="font-semibold">{clipName}</span>{" "}
							from <span className="font-semibold">{sourceTrackName}</span> to{" "}
							<span className="font-semibold">{targetTrackName}</span>.
						</p>
						{automationPointCount > 0 ? (
							<p>
								This track has{" "}
								<span className="font-semibold">
									{automationPointCount} automation point
									{automationPointCount !== 1 ? "s" : ""}
								</span>{" "}
								in the clip's time range. What would you like to do?
							</p>
						) : (
							<p className="text-muted-foreground text-sm">
								No automation data found in this clip's time range.
							</p>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						onClick={() => {
							onOpenChange(false);
							onConfirm(false);
						}}
					>
						Leave on {sourceTrackName}
					</Button>
					{automationPointCount > 0 ? (
						<Button
							onClick={() => {
								onOpenChange(false);
								onConfirm(true);
							}}
						>
							Move to {targetTrackName}
						</Button>
					) : (
						<Button
							onClick={() => {
								onOpenChange(false);
								onConfirm(false);
							}}
						>
							Continue
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
