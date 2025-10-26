import { describe, expect, it } from "vitest";
import { DAW_PIXELS_PER_SECOND_AT_ZOOM_1 } from "@/lib/constants";
import {
	alignHairline,
	clientXToMs,
	msToPx,
	msToViewportPx,
	type Scale,
	snapMs,
	viewportPxToMs,
} from "@/lib/daw-sdk/utils/scale";

describe("Scale utils", () => {
	it("should convert ms to viewport px correctly", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 0 };
		expect(msToViewportPx(1000, scale)).toBe(100);
	});

	it("should convert viewport px to ms correctly", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 0 };
		expect(viewportPxToMs(100, scale)).toBe(1000);
	});

	it("should handle scroll offset in conversions", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 50 };
		expect(msToViewportPx(1000, scale)).toBe(50); // 100 - 50
		expect(viewportPxToMs(50, scale)).toBe(1000); // (50 + 50) / 0.1
	});

	it("should convert clientX to ms correctly", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 0 };
		const clientX = 150;
		const elementLeft = 50;
		expect(clientXToMs(clientX, elementLeft, scale)).toBe(1000);
	});

	it("should align to hairline for crisp rendering", () => {
		expect(alignHairline(10.2)).toBe(10.5);
		expect(alignHairline(10.7)).toBe(11.5);
	});

	it("should snap to grid correctly", () => {
		expect(snapMs(1234, 1000)).toBe(1000);
		expect(snapMs(1567, 1000)).toBe(2000);
		expect(snapMs(1500, 1000)).toBe(2000);
	});

	it("should handle negative values gracefully", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 0 };
		expect(clientXToMs(-50, 0, scale)).toBe(0); // clamped to 0
	});

	it("should maintain precision across typical DAW ranges", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 1000 };
		const originalMs = 5000;
		const viewportX = msToViewportPx(originalMs, scale);
		const roundTripMs = viewportPxToMs(viewportX, scale);
		expect(Math.abs(roundTripMs - originalMs)).toBeLessThan(1);
	});

	describe("Round-trip precision across zoom levels", () => {
		const zooms = [0.25, 0.5, 1, 2, 4];
		const scrollLefts = [0, 500, 5000];
		const testMs = 10000; // 10 seconds

		zooms.forEach((zoom) => {
			scrollLefts.forEach((scrollLeft) => {
				it(`should maintain ±1ms precision at zoom ${zoom} and scroll ${scrollLeft}`, () => {
					const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000;
					const scale: Scale = { pxPerMs, scrollLeft };

					const viewportX = msToViewportPx(testMs, scale);
					const roundTripMs = viewportPxToMs(viewportX, scale);

					expect(Math.abs(roundTripMs - testMs)).toBeLessThanOrEqual(1);
				});
			});
		});
	});

	describe("Time-mode click accuracy", () => {
		const zooms = [0.25, 0.5, 1, 2, 4];
		const scrollLefts = [0, 500, 5000];

		zooms.forEach((zoom) => {
			scrollLefts.forEach((scrollLeft) => {
				it(`should convert 10s label click to 10000±1ms at zoom ${zoom} and scroll ${scrollLeft}`, () => {
					const pxPerMs = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom) / 1000;
					const scale: Scale = { pxPerMs, scrollLeft };

					// Simulate clicking at the 10s mark
					const targetMs = 10000;
					const clickViewportX = msToViewportPx(targetMs, scale);
					const computedMs = viewportPxToMs(clickViewportX, scale);

					expect(Math.abs(computedMs - targetMs)).toBeLessThanOrEqual(1);
				});
			});
		});
	});

	it("should guard against division by near-zero pxPerMs", () => {
		const scale: Scale = { pxPerMs: 1e-12, scrollLeft: 100 };
		const result = viewportPxToMs(50, scale);
		expect(result).toBe(0); // Should return 0 instead of infinity
	});

	describe("Scroll invariant", () => {
		it("should keep absolute time constant when scrolling", () => {
			const pxPerMs = 0.1;
			const ms0 = 10000;
			const scroll0 = 0;
			const scrollDelta = 500;

			const scale0: Scale = { pxPerMs, scrollLeft: scroll0 };
			const x0 = msToViewportPx(ms0, scale0);

			const scale1: Scale = { pxPerMs, scrollLeft: scroll0 + scrollDelta };
			const x1 = msToViewportPx(ms0, scale1);

			// Viewport X should shift by -scrollDelta
			expect(x1).toBe(x0 - scrollDelta);

			// But converting back should give the same ms
			const ms1 = viewportPxToMs(x1, scale1);
			expect(Math.abs(ms1 - ms0)).toBeLessThanOrEqual(1);
		});
	});

	describe("Viewport coordinate consistency", () => {
		it("should produce identical viewport positions from ms using same scale", () => {
			const pxPerMs = 0.1;
			const scrollLeft = 1000;
			const testMs = 5000;

			const scale: Scale = { pxPerMs, scrollLeft };

			// Different paths to viewport px should yield same result
			const viaAbsolute = msToPx(testMs, scale) - scrollLeft;
			const viaViewport = msToViewportPx(testMs, scale);

			expect(viaAbsolute).toBe(viaViewport);
		});
	});

	describe("Zoom-center invariant", () => {
		it("should preserve world anchor when zooming", () => {
			const zoom1 = 1;
			const zoom2 = 2;
			const scrollLeft1 = 500;
			const localX = 300; // cursor position in viewport

			const pxPerMs1 = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom1) / 1000;
			const pxPerMs2 = (DAW_PIXELS_PER_SECOND_AT_ZOOM_1 * zoom2) / 1000;

			// Compute world ms at cursor before zoom
			const worldMs = (scrollLeft1 + localX) / pxPerMs1;

			// After zoom, compute new scrollLeft to keep worldMs at same localX
			const scrollLeft2 = worldMs * pxPerMs2 - localX;

			// Verify round-trip
			const worldMsAfter = (scrollLeft2 + localX) / pxPerMs2;

			expect(Math.abs(worldMsAfter - worldMs)).toBeLessThanOrEqual(1);
		});
	});
});
