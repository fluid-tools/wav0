"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import {
	playbackAtom,
	totalDurationAtom,
	setCurrentTimeAtom,
	togglePlaybackAtom,
	timelineAtom,
	projectEndOverrideAtom,
	selectedTrackIdAtom,
	selectedClipIdAtom,
	splitClipAtPlayheadAtom,
	updateTrackAtom,
	updateClipAtom,
	tracksAtom,
} from "@/lib/state/daw-store";

export function GlobalShortcuts() {
	const [playback] = useAtom(playbackAtom);
	const [timeline] = useAtom(timelineAtom);
	const [tracks] = useAtom(tracksAtom);
	const [totalDuration] = useAtom(totalDurationAtom);
	const [, setCurrentTime] = useAtom(setCurrentTimeAtom);
	const [, togglePlayback] = useAtom(togglePlaybackAtom);
	const [, setProjectEndOverride] = useAtom(projectEndOverrideAtom);
	const [selectedTrackId, setSelectedTrackId] = useAtom(selectedTrackIdAtom);
	const [selectedClipId, setSelectedClipId] = useAtom(selectedClipIdAtom);
	const [, splitAtPlayhead] = useAtom(splitClipAtPlayheadAtom);
	const [, updateTrack] = useAtom(updateTrackAtom);
	const [, updateClip] = useAtom(updateClipAtom);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const inEditable =
				["INPUT", "TEXTAREA"].includes(tag || "") ||
				(e.target as HTMLElement)?.isContentEditable;
			if (inEditable) return;

			// Slash or ? opens dialog
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "/" || e.key === "?")
			) {
				e.preventDefault();
				window.dispatchEvent(new CustomEvent("wav0:open-shortcuts"));
				return;
			}

			// Space: play/pause
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === " ") {
				e.preventDefault();
				togglePlayback();
				return;
			}

			// S: Restart; Shift+S: Split at playhead
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
					setCurrentTime(0);
				}
				return;
			}

			// 1–9: select track
			if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
				e.preventDefault();
				const idx = parseInt(e.key, 10) - 1;
				const track = tracks[idx];
				if (track) setSelectedTrackId(track.id);
				return;
			}

			// Clip navigation within selected track: [ previous, ] next
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "[" || e.key === "]")
			) {
				e.preventDefault();
				if (!selectedTrackId) return;
				const track = tracks.find((t) => t.id === selectedTrackId);
				const clips = (track?.clips ?? [])
					.slice()
					.sort((a, b) => a.startTime - b.startTime);
				if (clips.length === 0) return;
				let idx = clips.findIndex((c) => c.id === selectedClipId);
				if (idx < 0) idx = 0;
				idx =
					e.key === "["
						? Math.max(0, idx - 1)
						: Math.min(clips.length - 1, idx + 1);
				setSelectedClipId(clips[idx].id);
				return;
			}

			// L: toggle loop for selected clip
			if (!e.ctrlKey && !e.metaKey && (e.key === "l" || e.key === "L")) {
				e.preventDefault();
				if (!selectedTrackId || !selectedClipId) return;
				const track = tracks.find((t) => t.id === selectedTrackId);
				const clip = track?.clips?.find((c) => c.id === selectedClipId);
				if (!clip) return;
				const loop = !clip.loop;
				const updates: Partial<typeof clip> = { loop };
				// Leave loopEnd as-is when toggling; user can set via Alt+L or Shift+L
				updateClip(selectedTrackId, clip.id, updates);
				return;
			}

			// Alt+L: set loopEnd to playhead; Shift+L: clear loopEnd
			if ((e.key === "l" || e.key === "L") && (e.altKey || e.shiftKey)) {
				e.preventDefault();
				if (!selectedTrackId || !selectedClipId) return;
				const track = tracks.find((t) => t.id === selectedTrackId);
				const clip = track?.clips?.find((c) => c.id === selectedClipId);
				if (!clip) return;
				if (e.shiftKey) {
					updateClip(selectedTrackId, clip.id, { loopEnd: undefined });
				} else if (e.altKey) {
					const clipDur = Math.max(0, clip.trimEnd - clip.trimStart);
					const oneShotEnd = clip.startTime + clipDur;
					const loopEnd = Math.max(oneShotEnd, playback.currentTime);
					updateClip(selectedTrackId, clip.id, { loop: true, loopEnd });
				}
				return;
			}

			// Arrow Left/Right: seek by grid; Shift+Arrow: adjust project end by grid
			const stepMs = timeline.gridSize || 500;
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "ArrowRight") {
				e.preventDefault();
				setCurrentTime(Math.min(playback.currentTime + stepMs, totalDuration));
				return;
			}
			if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "ArrowLeft") {
				e.preventDefault();
				setCurrentTime(Math.max(0, playback.currentTime - stepMs));
				return;
			}
			if (
				e.shiftKey &&
				!e.ctrlKey &&
				!e.metaKey &&
				(e.key === "ArrowLeft" || e.key === "ArrowRight")
			) {
				e.preventDefault();
				const delta = (e.key === "ArrowRight" ? 1 : -1) * stepMs;
				const end = Math.max(0, totalDuration + delta);
				setProjectEndOverride(end);
				return;
			}

			// Cmd+Left/Right: seek to start/end (Mac)
			if (
				e.metaKey &&
				!e.ctrlKey &&
				!e.altKey &&
				(e.key === "ArrowLeft" || e.key === "ArrowRight")
			) {
				e.preventDefault();
				setCurrentTime(e.key === "ArrowLeft" ? 0 : totalDuration);
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
		selectedClipId,
		tracks,
		setCurrentTime,
		togglePlayback,
		setProjectEndOverride,
		splitAtPlayhead,
		updateTrack,
		updateClip,
		setSelectedClipId,
		setSelectedTrackId,
	]);

	return null;
}
