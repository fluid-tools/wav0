/**
 * Atom exports for @wav0/daw-react
 */

// Base atoms (core state)
export * from "./base";
// Clip write atoms
export * from "./clips";
// Drag machine (legacy)
export { dragMachine } from "./machines/drag-machine";
// Unified interaction machine (handles clip drag, resize, loop drag)
export {
	type InteractionContext,
	type InteractionEvent,
	type InteractionState,
	interactionMachine,
} from "./machines/interaction-machine";
// Playback atoms (simple + write)
export * from "./playback";
// Project atoms (markers, grid, musical metadata)
export * from "./project";
// Service registration (single shared registry for all atoms)
export type { ServiceRegistry } from "./service-registry";
export { registerServices, serviceRegistry } from "./service-registry";
// Storage utilities
export { atomWithStorage } from "./storage";
// Timeline write atoms (zoom, scroll, snap, sections)
export * from "./timeline";
// Track write atoms
export * from "./tracks";
// UI atoms (selection, tools, inspector, drag)
export * from "./ui";
// View atoms (viewport, pxPerMs, grid caching)
export * from "./view";
