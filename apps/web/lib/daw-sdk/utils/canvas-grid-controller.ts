/**
 * Canvas Grid Controller for optimized timeline grid rendering
 * Uses Path2D batching and requestAnimationFrame for smooth 60fps performance
 */

export interface GridSubdivisions {
	measures: Array<{ ms: number; bar: number }>;
	beats: Array<{ ms: number; primary: boolean }>;
	subs: number[];
}

export interface CanvasGridControllerOptions {
	width: number;
	height: number;
	pxPerMs: number;
	scrollLeft: number;
	grid: GridSubdivisions;
	themeColors: {
		sub: string;
		beat: string;
		measure: string;
		label: string;
	};
}

export class CanvasGridController {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private rafId: number | null = null;
	private pendingOptions: CanvasGridControllerOptions | null = null;
	private isDrawing = false;

	// Path2D objects for batching
	private subsPath: Path2D | null = null;
	private beatsPath: Path2D | null = null;
	private measuresPath: Path2D | null = null;
	
	// Store measure data for labels
	private measuresData: Array<{ ms: number; bar: number }> = [];

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get 2D context");
		}
		this.ctx = ctx;
	}

	/**
	 * Schedule a grid redraw with the given options
	 * Uses requestAnimationFrame to batch multiple updates per frame
	 */
	draw(options: CanvasGridControllerOptions): void {
		this.pendingOptions = options;
		
		if (this.isDrawing) {
			// Already scheduled, just update pending options
			return;
		}

		this.scheduleDraw();
	}

	private scheduleDraw(): void {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
		}

		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			this.performDraw();
		});
	}

	private performDraw(): void {
		if (!this.pendingOptions) return;

		this.isDrawing = true;
		const options = this.pendingOptions;
		this.pendingOptions = null;

		try {
			this.drawGrid(options);
		} finally {
			this.isDrawing = false;
		}
	}

	private drawGrid(options: CanvasGridControllerOptions): void {
		const { width, height, pxPerMs, scrollLeft, grid, themeColors } = options;

		// Setup HiDPI scaling
		const dpr = window.devicePixelRatio || 1;
		this.canvas.width = Math.max(1, Math.floor(width * dpr));
		this.canvas.height = Math.max(1, Math.floor(height * dpr));
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Clear canvas
		this.ctx.clearRect(0, 0, width, height);

		// Build Path2D objects for batching
		this.buildPaths(grid, pxPerMs, scrollLeft, width, height);

		// Draw all paths in batches
		this.drawSubdivisions(themeColors.sub);
		this.drawBeats(themeColors.beat);
		this.drawMeasures(themeColors.measure);
		this.drawMeasureLabels(this.measuresData, pxPerMs, scrollLeft, width, themeColors.label);
	}

	private buildPaths(
		grid: GridSubdivisions,
		pxPerMs: number,
		scrollLeft: number,
		width: number,
		height: number
	): void {
		// Build subdivisions path
		this.subsPath = new Path2D();
		for (const ms of grid.subs) {
			const x = ms * pxPerMs - scrollLeft;
			if (x >= 0 && x <= width) {
				this.subsPath.moveTo(x, 0);
				this.subsPath.lineTo(x, height);
			}
		}

		// Build beats path
		this.beatsPath = new Path2D();
		for (const beat of grid.beats) {
			const x = beat.ms * pxPerMs - scrollLeft;
			if (x >= 0 && x <= width) {
				this.beatsPath.moveTo(x, 0);
				this.beatsPath.lineTo(x, height);
			}
		}

		// Build measures path and store data for labels
		this.measuresPath = new Path2D();
		this.measuresData = [];
		for (const measure of grid.measures) {
			const x = measure.ms * pxPerMs - scrollLeft;
			if (x >= 0 && x <= width) {
				this.measuresPath.moveTo(x, 0);
				this.measuresPath.lineTo(x, height);
				this.measuresData.push(measure);
			}
		}
	}

	private drawSubdivisions(color: string): void {
		if (!this.subsPath) return;

		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 0.5;
		this.ctx.stroke(this.subsPath);
	}

	private drawBeats(color: string): void {
		if (!this.beatsPath) return;

		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 1;
		this.ctx.stroke(this.beatsPath);
	}

	private drawMeasures(color: string): void {
		if (!this.measuresPath) return;

		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = 2;
		this.ctx.stroke(this.measuresPath);
	}

	/**
	 * Draw measure labels separately since Path2D doesn't store metadata
	 */
	private drawMeasureLabels(
		measures: Array<{ ms: number; bar: number }>,
		pxPerMs: number,
		scrollLeft: number,
		width: number,
		labelColor: string
	): void {
		this.ctx.fillStyle = labelColor;
		this.ctx.font = "10px monospace";
		let lastLabelX = -1e9;
		const minLabelSpacing = 28; // px

		for (const measure of measures) {
			const x = measure.ms * pxPerMs - scrollLeft;
			if (x - lastLabelX >= minLabelSpacing && x >= 0 && x <= width) {
				this.ctx.fillText(`${measure.bar}`, x + 4, 12);
				lastLabelX = x;
			}
		}
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.subsPath = null;
		this.beatsPath = null;
		this.measuresPath = null;
	}
}
