import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { calculateResponsiveGap, calculateLayout } = require('./layout');

describe('DG responsive image grid gap', () => {
    it.each([[0, 9], [320, 9], [375, 9], [547.5, 13.5], [720, 18], [858, 18]])(
        'uses the bounded gap at width %s', (width, expected) => {
            expect(calculateResponsiveGap(width, 18)).toBe(expected);
        });
    it('keeps other authored gaps proportional, including zero', () => {
        expect(calculateResponsiveGap(375, 8)).toBe(4);
        expect(calculateResponsiveGap(720, 8)).toBe(8);
        expect(calculateResponsiveGap(600, 0)).toBe(0);
    });
    it('is continuous at both thresholds', () => {
        for (const width of [375, 720]) {
            expect(Math.abs(calculateResponsiveGap(width - 0.001, 18) -
                calculateResponsiveGap(width + 0.001, 18))).toBeLessThan(0.001);
        }
    });
    it.each([[1, 1], [0.67, 1.5, 0.67], [1, 1, 1, 1]])(
        'fills the row with uncropped equal-height images: %j', (...ratios) => {
            const width = 480;
            const gap = calculateResponsiveGap(width, 18);
            const layout = calculateLayout(width, gap, ratios);
            expect(layout.widths.reduce((a, b) => a + b, 0) + gap * (ratios.length - 1)).toBeCloseTo(width, 10);
            layout.widths.forEach((w, i) => expect(w / layout.height).toBeCloseTo(ratios[i], 10));
        });
    it('retains invalid-input and insufficient-width errors', () => {
        for (const gap of [-1, NaN, Infinity]) expect(() => calculateLayout(375, gap, [1, 1])).toThrow();
        for (const gap of [-1, 1.5, Infinity]) expect(() => calculateResponsiveGap(375, gap)).toThrow();
        expect(() => calculateResponsiveGap(-1, 18)).toThrow();
        expect(() => calculateLayout(10, 18, [1, 1])).toThrow();
    });
});
