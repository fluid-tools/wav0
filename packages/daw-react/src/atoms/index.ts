/**
 * Atom exports for @wav0/daw-react
 */

// Base atoms (core state)
export * from "./base";
// Clip write atoms
export * from "./clips";
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
// Service atoms (reactive service access)
export type {
	AudioService,
	PlaybackService,
	ServiceRegistry,
	Services,
} from "./service-registry";
export {
	registerServices,
	serviceRegistry,
	servicesAtom,
} from "./service-registry";
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
