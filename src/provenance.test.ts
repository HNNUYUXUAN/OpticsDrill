import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const generator = fileURLToPath(
  new URL("../scripts/bank.mjs", import.meta.url),
);
const sha = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
async function fixture(
  run: (root: string, row: Record<string, unknown>) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "optics-provenance-"));
  try {
    await mkdir(join(root, "sources/solutions"), { recursive: true });
    await mkdir(join(root, "public/figures"), { recursive: true });
    const prompt = "自编样例：距离2 m。第一问求值；第二问说明单位。";
    const asset = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5l8AAAAASUVORK5CYII=",
      "base64",
    );
    const row = {
      id: "sample.1",
      categoryId: "sample",
      page: "self-authored",
      title: "自编样例",
      prompt,
      figure: "",
      figures: [
        { src: "figures/sample.png", alt: "自编样例第一图" },
        { src: "figures/second.png", alt: "自编样例第二图" },
      ],
      contentRevision: 3,
      solutionRevision: 4,
      source: { identity: "self-authored:sample.1" },
      verified: true,
      check: "2",
      expected: "2",
      result: "2",
      judgment: {
        correct: "单位一致",
        incorrect: "单位可忽略",
        reason: "量纲",
      },
      tags: [],
    };
    await writeFile(
      join(root, "sources/questions.json"),
      JSON.stringify([row]),
    );
    await writeFile(
      join(root, "sources/provenance.json"),
      JSON.stringify([
        {
          id: row.id,
          promptSha256: sha(prompt),
          figures: [
            { src: "figures/sample.png", sha256: sha(asset) },
            { src: "figures/second.png", sha256: sha(asset) },
          ],
          sourceIdentity: row.source.identity,
          verified: true,
        },
      ]),
    );
    await writeFile(
      join(root, "sources/meta.json"),
      JSON.stringify({
        bankVersion: 3,
        courseIds: [row.id],
        categories: [{ id: "sample", name: "自编" }],
      }),
    );
    await writeFile(join(root, "sources/rules.md"), "自编兼容样例");
    await writeFile(
      join(root, "sources/solutions/sample.1.md"),
      ["已知与求解", "依据", "推导", "结果", "阅卷要点"]
        .map((s) => "### " + s + "\n自编说明\n")
        .join("\n"),
    );
    await writeFile(join(root, "public/figures/sample.png"), asset);
    await writeFile(join(root, "public/figures/second.png"), asset);
    await run(root, row);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function generate(root: string) {
  return execFileSync(process.execPath, [generator, "--root", root], {
    encoding: "utf8",
    stdio: "pipe",
  });
}
describe("public verified provenance gate", () => {
  it("passes an approved self-authored fixture with maintained identities and revisions", () =>
    fixture(async (root) => {
      expect(generate(root)).toContain("Generated 1");
      const bank = JSON.parse(
        await readFile(join(root, "src/data/bank.json"), "utf8"),
      );
      expect(bank.questions[0].source.identity).toBe("self-authored:sample.1");
      expect(bank.questions[0].contentRevision).toBe(3);
      expect(bank.questions[0].variants[0].revision).toBe(4);
      expect(
        bank.questions[0].figures.map((f: { src: string }) => f.src),
      ).toEqual(["figures/sample.png", "figures/second.png"]);
    }));
  it("rejects changed numbers and missing subquestions", () =>
    fixture(async (root, row) => {
      for (const prompt of [
        "自编样例：距离3 m。第一问求值；第二问说明单位。",
        "自编样例：距离2 m。第一问求值。",
      ]) {
        await writeFile(
          join(root, "sources/questions.json"),
          JSON.stringify([{ ...row, prompt }]),
        );
        expect(() => generate(root)).toThrow(/已复核清单不符/);
      }
    }));
  it("rejects substituted or truncated image bytes and unverified inputs", () =>
    fixture(async (root, row) => {
      await writeFile(join(root, "public/figures/sample.png"), "wrong-image");
      expect(() => generate(root)).toThrow(/题图与已复核清单不符/);
      await writeFile(join(root, "public/figures/sample.png"), "fixt");
      expect(() => generate(root)).toThrow(/题图与已复核清单不符/);
      await writeFile(
        join(root, "sources/questions.json"),
        JSON.stringify([{ ...row, verified: false }]),
      );
      expect(() => generate(root)).toThrow(/尚未核验/);
    }));
  it("rejects changing picture order or stable source identity", () =>
    fixture(async (root, row) => {
      await writeFile(
        join(root, "sources/questions.json"),
        JSON.stringify([
          {
            ...row,
            figures: [...(row.figures as [])].reverse(),
          },
        ]),
      );
      expect(() => generate(root)).toThrow(/题图顺序/);
      await writeFile(
        join(root, "sources/questions.json"),
        JSON.stringify([{ ...row, source: { identity: "other-source" } }]),
      );
      expect(() => generate(root)).toThrow(/题面或题源/);
    }));
  it("rejects a provenance record whose verified status was withdrawn", () =>
    fixture(async (root) => {
      const file = join(root, "sources/provenance.json");
      const proof = JSON.parse(await readFile(file, "utf8"));
      proof[0].verified = false;
      await writeFile(file, JSON.stringify(proof));
      expect(() => generate(root)).toThrow(/题面或题源/);
    }));
});
