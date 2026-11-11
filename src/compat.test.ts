import { describe, expect, it, vi, afterEach } from "vitest";
import {
  bank,
  bankSchema,
  initial,
  importData,
  load,
  restoreState,
  start,
  submitAnswer,
  upgradeBank,
  type State,
  type Config,
} from "./core";

const config: Config = {
  profile: "primary",
  mode: "input",
  filter: "all",
  category: "",
  tag: "",
  order: "source",
  length: 1,
};
function practiced(state: State, qid: string) {
  const started = start(state, config, qid);
  return submitAnswer({
    ...started,
    session: {
      ...started.session!,
      draft: state.bank.questions.find((q) => q.id === qid)!.expected,
    },
  });
}
function legacyRaw() {
  const s = practiced(practiced(initial(), "1.1"), "1.2");
  s.bank = { ...s.bank, bankVersion: 2 };
  const old = {
    ...s,
    schemaVersion: 1,
    originalUnknownField: "must survive byte-for-byte archival",
  } as Record<string, unknown>;
  delete old.legacyArchives;
  delete old.migrationNotice;
  return JSON.stringify(old, null, 3);
}
afterEach(() => vi.unstubAllGlobals());
describe("source reconstruction compatibility", () => {
  it("archives an imported original schema 1 backup exactly and starts new progress", () => {
    const raw = legacyRaw();
    const restored = importData(raw);
    expect(restored.type).toBe("backup");
    const s = restored.data as State;
    expect(s.schemaVersion).toBe(2);
    expect(s.bank).toEqual(bank);
    expect(s.attempts).toEqual([]);
    expect(s.progress).toEqual({});
    expect(s.session).toBeNull();
    expect(s.legacyArchives).toHaveLength(1);
    expect(s.legacyArchives[0].raw).toBe(raw);
    expect(s.migrationNotice).toContain("完整归档");
    expect(importData(JSON.stringify(s)).data).toEqual(s);
  });
  it("loads an original local state without modifying its raw storage in core", () => {
    const raw = legacyRaw();
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const result = load();
    expect(result.error).toBe("");
    expect(result.state.legacyArchives[0].raw).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("rejects foreign app backups and keeps malformed raw storage recoverable", () => {
    expect(() =>
      importData(legacyRaw().replace('"OpticsDrill"', '"MechanicsDrill"')),
    ).toThrow();
    const storage = { getItem: vi.fn(() => "{broken"), setItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    expect(load().error).toContain("原数据仍保留");
    expect(storage.getItem()).toBe("{broken");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("loads corrected bundled content even when an old question source identity differs", () => {
    const s = practiced(initial(), "1.1");
    s.bank = structuredClone(s.bank);
    s.bank.bankVersion = Math.max(0, bank.bankVersion - 1);
    s.bank.questions[0].source.identity = "retired-source";
    const restored = restoreState(s);
    expect(restored.bank).toEqual(bank);
    expect(restored.progress["1.1:common"]).toBeUndefined();
    expect(restored.attempts).toHaveLength(0);
    expect(restored.legacyArchives).toHaveLength(1);
  });
  it("preserves unchanged progress and archives only incompatible active history", () => {
    const s = practiced(practiced(initial(), "1.1"), "1.2");
    const b = structuredClone(bank);
    b.bankVersion += 1;
    b.questions[0].contentRevision += 1;
    const upgraded = upgradeBank(s, b);
    expect(upgraded.progress["1.1:common"]).toBeUndefined();
    expect(upgraded.progress["1.2:common"]).toEqual(s.progress["1.2:common"]);
    expect(upgraded.attempts.map((a) => a.qid)).toEqual(["1.2"]);
    expect(JSON.parse(upgraded.legacyArchives[0].raw).attempts).toHaveLength(2);
  });
  it("ends an incompatible draft and preserves a compatible draft", () => {
    const s = start(initial(), config, "1.1");
    s.session!.draft = "unfinished";
    const unchanged = structuredClone(bank);
    unchanged.bankVersion += 1;
    expect(upgradeBank(s, unchanged).session).toEqual(s.session);
    unchanged.questions[0].variants[0].revision += 1;
    expect(upgradeBank(s, unchanged).session).toBeNull();
  });
  it("keeps archives parallel during further content updates", () => {
    const migrated = importData(legacyRaw()).data as State;
    const s = practiced(migrated, "1.1");
    const changed = structuredClone(bank);
    changed.bankVersion += 1;
    changed.questions[0].variants[0].revision += 1;
    const upgraded = upgradeBank(s, changed);
    expect(upgraded.legacyArchives).toHaveLength(2);
    expect(upgraded.legacyArchives[0]).toEqual(migrated.legacyArchives[0]);
    expect(JSON.parse(upgraded.legacyArchives[1].raw).legacyArchives).toEqual(
      [],
    );
  });
  it("normalizes legacy single figures and preserves ordered PNG/WebP/SVG figures", () => {
    const b = structuredClone(bank);
    b.questions[0].figures = [];
    b.questions[0].figure = "figures/plate.svg";
    expect(bankSchema.parse(b).questions[0].figures[0].src).toBe(
      "figures/plate.svg",
    );
    b.questions[0].figures = [
      { src: "figures/ch01/first.png", alt: "第一页" },
      { src: "figures/ch01/second.webp", alt: "续页" },
      { src: "figures/plate.svg" },
    ];
    expect(bankSchema.parse(b).questions[0].figures).toEqual(
      b.questions[0].figures,
    );
    b.questions[0].figures[0].src = "figures/../../private.png";
    expect(() => bankSchema.parse(b)).toThrow();
  });
});
