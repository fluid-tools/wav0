"use client";

import { useAtom } from "jotai";
import { useEffect } from "react";
import {
	automationViewEnabledAtom,
	playbackAtom,
	projectEndOverrideAtom,
	resetProjectAtom,
	selectedClipIdAtom,
	selectedTrackIdAtom,
	setCurrentTimeAtom,
	splitClipAtPlayheadAtom,
	timelineAtom,
	togglePlaybackAtom,
	totalDurationAtom,
	tracksAtom,
	updateClipAtom,
} from "@/lib/daw-sdk";
import { computeLoopEndMs } from "@/lib/daw-sdk/config/looping";

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
	const [, updateClip] = useAtom(updateClipAtom);
	const [automationViewEnabled, setAutomationViewEnabled] = useAtom(
		automationViewEnabledAtom,
	);
	const [, resetProject] = useAtom(resetProjectAtom);

	useEffect(() => {
		const ensureSelection = () => {
			// Ensure a track is selected
			let trackId = selectedTrackId;
			if (!trackId) {
				// Prefer track with a clip under playhead, else first track
				const t = playback.currentTime;
				const found = tracks.find((tr) =>
					(tr.clips ?? []).some(
						(c) =>
							t >= c.startTime &&
							t < c.startTime + Math.max(0, c.trimEnd - c.trimStart),
					),
				);
				if (found) trackId = found.id;
				else if (tracks[0]) trackId = tracks[0].id;
				if (trackId) setSelectedTrackId(trackId);
			}
			// Ensure a clip is selected on that track
			if (trackId) {
				const track = tracks.find((t) => t.id === trackId);
				const clips = (track?.clips ?? [])
					.slice()
					.sort((a, b) => a.startTime - b.startTime);
				if (clips.length > 0) {
					let clipId = selectedClipId;
					if (!clipId) {
						const t = playback.currentTime;
						const under = clips.find(
							(c) =>
								t >= c.startTime &&
								t < c.startTime + Math.max(0, c.trimEnd - c.trimStart),
						);
						clipId = under ? under.id : clips[clips.length - 1].id;
						setSelectedClipId(clipId);
					}
				}
			}
		};

		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const inEditable =
				["INPUT", "TEXTAREA"].includes(tag || "") ||
				(e.target as HTMLElement)?.isContentEditable;
			if (inEditable) return;

			// Cmd+K (primary on macOS) or / or ? open dialog
			if (
				(e.metaKey && e.key.toLowerCase() === "k") ||
				(!e.ctrlKey &&
					!e.metaKey &&
					!e.altKey &&
					(e.key === "/" || e.key === "?"))
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

			// A: Toggle automation view
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				!e.shiftKey &&
				e.key.toLowerCase() === "a"
			) {
				e.preventDefault();
				setAutomationViewEnabled(!automationViewEnabled);
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
					ensureSelection();
					splitAtPlayhead();
				} else {
					setCurrentTime(0);
				}
				return;
			}

			// 1–9: select track (and auto-select clip under playhead or rightmost)
			if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
				e.preventDefault();
				const idx = parseInt(e.key, 10) - 1;
				const track = tracks[idx];
				if (track) {
					setSelectedTrackId(track.id);
					const clips = (track.clips ?? [])
						.slice()
						.sort((a, b) => a.startTime - b.startTime);
					if (clips.length > 0) {
						const t = playback.currentTime;
						const under = clips.find(
							(c) =>
								t >= c.startTime &&
								t < c.startTime + Math.max(0, c.trimEnd - c.trimStart),
						);
						setSelectedClipId((under ?? clips[clips.length - 1]).id);
					} else {
						setSelectedClipId(null);
					}
				}
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
				ensureSelection();
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
				requestAnimationFrame(() => {
					const el = document.querySelector(
						`[data-clip-id="${clips[idx].id}"]`,
					) as HTMLElement | null;
					el?.scrollIntoView({ block: "nearest", inline: "nearest" });
				});
				return;
			}

			// Option+L: set loopEnd to playhead; Shift+L: clear loopEnd (handle before plain L)
			if ((e.key === "l" || e.key === "L") && (e.altKey || e.shiftKey)) {
				e.preventDefault();
				ensureSelection();
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

			// L: toggle loop (parity with toolbar defaults)
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				(e.key === "l" || e.key === "L")
			) {
				e.preventDefault();
				ensureSelection();
				if (!selectedTrackId || !selectedClipId) return;
				const track = tracks.find((t) => t.id === selectedTrackId);
				const clip = track?.clips?.find((c) => c.id === selectedClipId);
				if (!clip) return;
				const isLooping = clip.loop === true;
				if (isLooping) {
					updateClip(selectedTrackId, clip.id, {
						loop: false,
						loopEnd: undefined,
					});
				} else {
					const loopEnd = computeLoopEndMs(clip);
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

			// Cmd/Ctrl+Shift+Backspace: Reset project
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Backspace") {
				e.preventDefault();
				if (
					confirm(
						"Reset project to default state? This will clear all tracks and settings.",
					)
				) {
					resetProject();
				}
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
		updateClip,
		setSelectedClipId,
		setSelectedTrackId,
		automationViewEnabled,
		setAutomationViewEnabled,
		resetProject,
	]);

	return null;
}
