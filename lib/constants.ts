// Audio generation constants
export const SOUND_PROMPT_MAX_LENGTH = 500;
export const TTS_TEXT_MAX_LENGTH = 2500;
export const SOUND_DURATION_MIN = 0.1;
export const SOUND_DURATION_MAX = 22;
export const SOUND_DURATION_DEFAULT = 10;
export const PROMPT_INFLUENCE_DEFAULT = 0.3;
export const TITLE_PREVIEW_LENGTH = 50;

// DAW UI constants (keep grid and tracklist aligned)
export const DAW_ROW_HEIGHT = 88; // px (matches ~h-22 Tailwind)
export const DAW_TIMELINE_HEADER_HEIGHT = 64; // px (h-16)
export const DAW_PIXELS_PER_SECOND_AT_ZOOM_1 = 100; // px

// Folder/Project validation constants
export const FOLDER_NAME_MAX_LENGTH = 255;
export const PROJECT_NAME_MAX_LENGTH = 255;
export const NAME_MIN_LENGTH = 1;

// Presigned URL duration (in seconds)
export const PRESIGNED_URL_DURATION = 60 * 60; // 1 hour
