import { describe, expect, it } from "vitest";
import {
	clientXToMs,
	msToPx,
	msToViewportPx,
	type Scale,
	snapMs,
	viewportPxToMs,
} from "@/lib/daw-sdk/utils/scale";

describe("scale utils precision", () => {
	const zoomLevels = [0.2, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2, 3, 4, 5];
	const scrollLevels = [0, 1, 5, 13, 29, 97];
	const timeSamples = [0, 10, 123, 1000, 10000, 60321];

	it("roundtrip: ms → viewport px → ms", () => {
		for (const zoom of zoomLevels) {
			for (const scroll of scrollLevels) {
				const pxPerMs = (100 * zoom) / 1000; // DAW_PIXELS_PER_SECOND_AT_ZOOM_1 = 100
				const scale: Scale = { pxPerMs, scrollLeft: scroll };

				for (const ms of timeSamples) {
					const viewportPx = msToViewportPx(ms, scale);
					const backToMs = viewportPxToMs(viewportPx, scale);
					const error = Math.abs(backToMs - ms);

					expect(error).toBeLessThan(0.001);
				}
			}
		}
	});

	it("roundtrip: viewport px → ms → viewport px", () => {
		for (const zoom of zoomLevels) {
			for (const scroll of scrollLevels) {
				const pxPerMs = (100 * zoom) / 1000;
				const scale: Scale = { pxPerMs, scrollLeft: scroll };

				for (let px = 0; px < 10000; px += 50) {
					const ms = viewportPxToMs(px, scale);
					const backToPx = msToViewportPx(ms, scale);
					const error = Math.abs(backToPx - px);

					expect(error).toBeLessThan(0.01);
				}
			}
		}
	});

	it("clientXToMs handles scroll correctly", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 100 };
		const elementLeft = 50;

		// At clientX = 150, localX = 100, absolute = 200, ms = 2000
		const ms = clientXToMs(150, elementLeft, scale);
		expect(ms).toBeCloseTo(2000, 3);
	});

	it("snapMs rounds to nearest step", () => {
		expect(snapMs(123, 100)).toBe(100);
		expect(snapMs(176, 100)).toBe(200);
		expect(snapMs(250, 100)).toBe(300); // 250 rounds up to 300
		expect(snapMs(249, 100)).toBe(200); // 249 rounds down to 200
		expect(snapMs(0, 100)).toBe(0);
	});

	it("msToPx and msToViewportPx difference equals scroll", () => {
		const scale: Scale = { pxPerMs: 0.1, scrollLeft: 500 };
		const ms = 10000;

		const absolutePx = msToPx(ms, scale);
		const viewportPx = msToViewportPx(ms, scale);

		expect(absolutePx - viewportPx).toBe(500);
	});
});
