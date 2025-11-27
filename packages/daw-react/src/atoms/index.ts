/**
 * Atom exports for @wav0/daw-react
 */

// Base atoms (core state)
export * from "./base";
// Clip write atoms
export * from "./clips";
// Playback atoms (simple + write)
export * from "./playback";
// Project atoms (markers, grid, musical metadata)
export * from "./project";
// Timeline write atoms (zoom, scroll, snap, sections)
export * from "./timeline";
// UI atoms (selection, tools, inspector, drag)
export * from "./ui";
// View atoms (viewport, pxPerMs, grid caching)
export * from "./view";
// Drag machine
export { dragMachine } from "./machines/drag-machine";
// Service registration (single shared registry for all atoms)
export type { ServiceRegistry } from "./service-registry";
export { registerServices, serviceRegistry } from "./service-registry";
// Storage utilities
export { atomWithStorage } from "./storage";
// Track write atoms
export * from "./tracks";
