/**
 * WAV0 DAW SDK - Legacy Compatibility Layer
 *
 * @deprecated This module is deprecated. Import directly from:
 * - @wav0/daw-sdk for types and utilities
 * - @wav0/daw-react for atoms, hooks, and providers
 *
 * This file only exists to provide the legacy PlaybackService
 * for DAWProvider initialization during the migration period.
 */

// ===== Legacy Services (still required for DAWProvider) =====
export { PlaybackService, playbackService } from "./core/playback-service";
