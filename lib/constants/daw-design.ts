// DAW Design System Constants
// Centralized styling constants for consistency across DAW components

// Heights - standardized component heights
export const DAW_HEIGHTS = {
	TOOLBAR: 48, // 12 * 4 = 3rem
	CONTROLS: 56, // 14 * 4 = 3.5rem
	TIMELINE: 64, // 16 * 4 = 4rem
	TRACK_ROW: 100, // New base track height (was 125% of old 80px)
	TRACK_ROW_MIN: 60, // Minimum track height
	TRACK_ROW_MAX: 200, // Maximum track height
	BUTTON_SM: 28, // 7 * 4
	BUTTON_MD: 32, // 8 * 4
	BUTTON_LG: 40, // 10 * 4
} as const;

// Track height zoom levels (adjusted scale)
export const DAW_TRACK_ZOOM = {
	MIN: 0.6, // 60% = 60px (was 75%)
	DEFAULT: 1.0, // 100% = 100px (was 125%)
	MAX: 2.0, // 200% = 200px (was 250%)
	STEP: 0.2, // 20% increments for cleaner values
} as const;

// Spacing - consistent padding and margins
export const DAW_SPACING = {
	TRACK_PADDING: 12, // Track list and content padding
	SECTION_PADDING: 16, // Section containers
	CONTROL_GAP: 8, // Gap between control elements
	COMPONENT_GAP: 12, // Gap between major components
} as const;

// Colors - semantic color usage
export const DAW_COLORS = {
	// Selection states
	SELECTED_BG: "bg-muted/30",
	HOVER_BG: "bg-muted/20",

	// Borders
	BORDER_DEFAULT: "border-border/50",
	BORDER_STRONG: "border-border",

	// Backgrounds
	BG_PANEL: "bg-muted/10",
	BG_SURFACE: "bg-background/50",
	BG_OVERLAY: "bg-muted/20",

	// Interactive elements
	PLAYHEAD: "bg-red-500",
	PROJECT_END: "bg-yellow-500/70",

	// Track colors (cycling)
	TRACK_COLORS: [
		"#3b82f6", // blue
		"#ef4444", // red
		"#10b981", // green
		"#f59e0b", // yellow
		"#8b5cf6", // purple
		"#06b6d4", // cyan
		"#f97316", // orange
		"#84cc16", // lime
	],
} as const;

// Icon sizes - consistent icon sizing
export const DAW_ICONS = {
	XS: "w-3 h-3", // 12px - small indicators
	SM: "w-3.5 h-3.5", // 14px - zoom controls
	MD: "w-4 h-4", // 16px - default buttons
	LG: "w-5 h-5", // 20px - play/pause
} as const;

// Button variants - consistent button styling
export const DAW_BUTTONS = {
	TRANSPARENT: "bg-transparent border-none p-0",
	PANEL: "bg-background/50 rounded-lg border",
	CONTROL_GROUP:
		"flex items-center gap-1 bg-background/50 rounded-lg border p-1",
} as const;

// Z-index layers - consistent layering
export const DAW_Z_INDEX = {
	BACKGROUND: 10,
	OVERLAY: 20,
	MARKERS: 30,
	CONTENT: 40,
	PLAYHEAD: 50,
} as const;

// Typography - consistent text styling
export const DAW_TEXT = {
	MONO_TIME: "text-xs font-mono text-muted-foreground tabular-nums",
	TRACK_NAME: "text-sm font-medium truncate text-left",
	SECTION_TITLE: "text-sm font-medium",
	BRAND: "text-sm font-mono uppercase tracking-tight font-bold",
} as const;
