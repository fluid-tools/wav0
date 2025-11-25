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
export type { ServiceRegistry } from "./service-registry";
// Service registration (single shared registry for all atoms)
export { registerServices, serviceRegistry } from "./service-registry";
// Storage utilities
export { atomWithStorage } from "./storage";
// Track write atoms
export * from "./tracks";
