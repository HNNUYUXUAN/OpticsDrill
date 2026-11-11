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
  it("uses the textbook bright-ring order starting at zero", () => {
    const ratio =
      (Math.sqrt(20.5) - Math.sqrt(19.5)) / (Math.sqrt(3.5) - Math.sqrt(2.5));
    expect(ratio.toFixed(3)).toBe(q("1.16").expected);
  });
  it("uses textbook second interference order for the soap film", () => {
    const thickness = (5 * 700) / (4 * Math.sqrt(1.33 ** 2 - 0.5 ** 2));
    expect(thickness.toFixed(0)).toBe(q("1.7").expected);
  });
  it("uses the convex mirror stated in the original exercise", () => {
    const image = 1 / (1 / -10 - 1 / 40);
    const plate = (40 + image) / 2;
    expect((40 - plate).toFixed(1)).toBe(q("3.8").expected);
    expect(q("3.8").prompt).toContain("凸面镜");
  });
  it("preserves the actual original figures and source subquestions", () => {
    expect(
      bank.questions.filter((x) => x.figures.length).map((x) => x.id),
    ).toEqual(["1.19", "3.3", "3.21"]);
    expect(q("1.19").prompt).toContain("（2）光屏上呈现的干涉图样");
    expect(q("6.7").prompt).toContain("600 nm");
    expect(q("8.4").prompt).not.toContain("632.8");
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
