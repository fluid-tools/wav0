"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import {
	playbackAtom,
	totalDurationAtom,
	setCurrentTimeAtom,
	togglePlaybackAtom,
	stopPlaybackAtom,
	timelineAtom,
	projectEndOverrideAtom,
	selectedTrackIdAtom,
	splitClipAtPlayheadAtom,
	updateTrackAtom,
	tracksAtom,
} from "@/lib/state/daw-store";

export function GlobalShortcuts() {
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [tracks] = useAtom(tracksAtom);
	const [totalDuration] = useAtom(totalDurationAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, stopPlayback] = useAtom(stopPlaybackAtom);
	const [, setProjectEndOverride] = useAtom(projectEndOverrideAtom);
	const [selectedTrackId] = useAtom(selectedTrackIdAtom);
	const [, splitAtPlayhead] = useAtom(splitClipAtPlayheadAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const inEditable =
				["INPUT", "TEXTAREA"].includes(tag || "") ||
				(e.target as HTMLElement)?.isContentEditable;
			if (inEditable) return;

			// ? opens dialog (if exists); we emit a custom event for the toolbar to capture
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "?") {
				e.preventDefault();
				window.dispatchEvent(new CustomEvent("wav0:open-shortcuts"));
				return;
			}

			// Space: play/pause; Shift+Space: stop
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === " ") {
				e.preventDefault();
				if (e.shiftKey) {
					stopPlayback();
				} else {
					togglePlayback();
				}
				return;
			}

			// S: Stop; Shift+S: Split at playhead
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "s" || e.key === "S")
			) {
				e.preventDefault();
				if (e.shiftKey) {
					splitAtPlayhead();
				} else {
					stopPlayback();
				}
				return;
			}

			// L: toggle loop on selected clip via UI controls (no direct atom here)
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "l" || e.key === "L")
			) {
				// no-op here; the UI button handles toggle on selection context
				return;
			}

			// M: mute selected track; Shift+M: solo selected track
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "m" || e.key === "M")
			) {
				e.preventDefault();
				if (!selectedTrackId) return;
				const track = tracks.find((t) => t.id === selectedTrackId);
				if (!track) return;
				if (e.shiftKey) {
					updateTrack(selectedTrackId, { soloed: !track.soloed });
				} else {
					updateTrack(selectedTrackId, { muted: !track.muted });
				}
				return;
			}

			// Arrow Left/Right: seek playhead; Alt+Arrows: move project end; Shift = x4
			const stepMs = (timeline.gridSize || 500) * (e.shiftKey ? 4 : 1);
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "ArrowRight") {
				e.preventDefault();
				const t = Math.min(playback.currentTime + stepMs, totalDuration);
				setCurrentTime(t);
				return;
			}
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "ArrowLeft") {
				e.preventDefault();
				const t = Math.max(0, playback.currentTime - stepMs);
				setCurrentTime(t);
				return;
			}
			if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowRight") {
				e.preventDefault();
				const end = Math.min(totalDuration + stepMs, Number.MAX_SAFE_INTEGER);
				setProjectEndOverride(end);
				return;
			}
			if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowLeft") {
				e.preventDefault();
				const end = Math.max(0, totalDuration - stepMs);
				setProjectEndOverride(end);
				return;
			}

			// Home/End: seek to 0 / seek to project end
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Home") {
				e.preventDefault();
				setCurrentTime(0);
				return;
			}
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "End") {
				e.preventDefault();
				setCurrentTime(totalDuration);
				return;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		playback.currentTime,
		timeline.gridSize,
		totalDuration,
		selectedTrackId,
		tracks,
		setCurrentTime,
		togglePlayback,
		stopPlayback,
		setProjectEndOverride,
		splitAtPlayhead,
		updateTrack,
	]);

	return null;
}
