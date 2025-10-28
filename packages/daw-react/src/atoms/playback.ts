/**
 * Playback state atoms
 */

"use client";

import { atom } from "jotai";

export const isPlayingAtom = atom(false);
export const currentTimeAtom = atom(0);
export const bpmAtom = atom(120);
export const loopingAtom = atom(false);

