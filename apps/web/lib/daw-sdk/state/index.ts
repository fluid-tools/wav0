/**
 * DAW SDK State Barrel
 *
 * @deprecated This entire folder is legacy code. The main lib/daw-sdk/index.ts
 * now re-exports atoms from @wav0/daw-react/atoms. These files are no longer
 * imported and can be deleted once we verify no direct imports exist.
 *
 * Migration status:
 * - atoms.ts, clips.ts, playback.ts, project.ts, timeline.ts, tracks.ts, ui.ts, view.ts:
 *   All ported to @wav0/daw-react/src/atoms/. These are UNUSED DUPLICATES.
 * - types.ts: Types now in @wav0/daw-sdk/types/schemas.ts
 * - automation-migration.ts: Moved to @wav0/daw-sdk/utils/automation.ts namespace
 *
 * DO NOT add new code here. Use @wav0/daw-react instead.
 */

export * from "./atoms";
export * from "./clips";
export * from "./playback";
export * from "./project";
export * from "./timeline";
export * from "./tracks";
export * from "./types";
export * from "./ui";
export * from "./view";
