"use client";

import { useAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "sonner";
import { clipMoveHistoryAtom, tracksAtom } from "@/lib/daw-sdk";

export function ClipMoveToastManager() {
    const [moveHistory] = useAtom(clipMoveHistoryAtom);
    const [, setTracks] = useAtom(tracksAtom);

    useEffect(() => {
        const latestMove = moveHistory[0];
        if (!latestMove) return;

        if (Date.now() - latestMove.timestamp > 1000) return;

        const message = latestMove.automationData
            ? `Moved clip with ${latestMove.automationData.points.length} automation points`
            : `Moved clip`;

        toast(message, {
            action: {
                label: "Undo",
                onClick: () => {
                    setTracks((prev) => {
                        const updated = prev.map((t) => {
                            // Move back clip and restore automation
                            if (t.id === latestMove.toTrackId) {
                                return {
                                    ...t,
                                    clips: (t.clips ?? []).filter((c) => c.id !== latestMove.clipId),
                                };
                            }
                            if (t.id === latestMove.fromTrackId) {
                                const clipOnTarget = prev
                                    .find((x) => x.id === latestMove.toTrackId)?.clips?.find((c) => c.id === latestMove.clipId);
                                if (!clipOnTarget) return t;
                                const restoredClip = { ...clipOnTarget, startTime: latestMove.fromStartTime };
                                const restored: typeof t = {
                                    ...t,
                                    clips: [...(t.clips ?? []), restoredClip],
                                };
                                if (latestMove.automationData) {
                                    const env = restored.volumeEnvelope || { enabled: true, points: [], segments: [] };
                                    restored.volumeEnvelope = {
                                        ...env,
                                        enabled: true,
                                        points: [...(env.points || []), ...latestMove.automationData.points].sort((a, b) => (a.time as number) - (b.time as number)),
                                        segments: [...(env.segments || []), ...latestMove.automationData.segments],
                                    };
                                }
                                return restored;
                            }
                            return t;
                        });
                        return updated;
                    });
                },
            },
            duration: 5000,
        });
    }, [moveHistory, setTracks]);

    return null;
}


