import { describe, it, expect } from "vitest";
import { bank } from "./core";
const q = (id: string) => bank.questions.find((q) => q.id === id)!;
describe("course content numerical regressions", () => {
  it("preserves the designated chapter scope", () => {
    expect(
      bank.categories.map(
        (c) => bank.questions.filter((q) => q.categoryId === c.id).length,
      ),
    ).toEqual([11, 8, 8, 7, 6, 4, 5, 3]);
  });
  it("counts reflected bright rings from the first ring", () => {
    const ratio =
      (Math.sqrt(19.5) - Math.sqrt(18.5)) / (Math.sqrt(2.5) - Math.sqrt(1.5));
    expect(ratio.toFixed(3)).toBe(q("1.16").expected);
  });
  it("uses the virtual-source to screen distance for the split lens", () => {
    const v = 1 / (1 / 50 - 1 / 25),
      magnification = -v / 25;
    const separation = (Math.abs(1 - magnification) * 1) / 100;
    const screenDistance = (50 - v) / 100;
    expect((((692e-9 * screenDistance) / separation) * 1000).toFixed(4)).toBe(
      q("1.19").expected,
    );
  });
  it("uses exact side maxima rather than half-integer extrema", () => {
    const root = (order: number) => {
      let lo = order * Math.PI + 1e-8,
        hi = (order + 0.5) * Math.PI - 1e-8;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        if (Math.tan(mid) - mid > 0) hi = mid;
        else lo = mid;
      }
      return (lo + hi) / 2;
    };
    expect(((600 * root(2)) / root(3)).toFixed(1)).toBe(q("2.8").expected);
  });
});
