import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--root"))
  throw Error("Usage: node bank.mjs [--root PROJECT]");
const root = args.length
  ? pathToFileURL(resolve(args[1]) + "/")
  : new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const rows = JSON.parse(await read("sources/questions.json"));
const meta = JSON.parse(await read("sources/meta.json"));
const provenance = JSON.parse(await read("sources/provenance.json"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const ids = rows.map((q) => q.id);
if (
  new Set(ids).size !== ids.length ||
  JSON.stringify(ids) !== JSON.stringify(meta.courseIds) ||
  JSON.stringify(ids) !== JSON.stringify(provenance.map((p) => p.id))
)
  throw Error("题号清单与课程范围不一致");
const questions = await Promise.all(
  rows.map(
    async ({ page, verified, source, solutionRevision, ...q }, index) => {
      const category = meta.categories.find((c) => c.id === q.categoryId);
      if (!category || !page) throw Error("缺少模块或来源 " + q.id);
      if (verified !== true) throw Error("题源尚未核验 " + q.id);
      if (
        !source ||
        typeof source.identity !== "string" ||
        !source.identity.trim()
      )
        throw Error("缺少稳定题源身份 " + q.id);
      for (const [name, value] of Object.entries({
        contentRevision: q.contentRevision,
        solutionRevision,
      }))
        if (!Number.isInteger(value) || value < 1)
          throw Error("缺少有效版本 " + q.id + ":" + name);
      const solution = (await read("sources/solutions/" + q.id + ".md"))
        .replaceAll("\r\n", "\n")
        .trim();
      for (const h of ["已知与求解", "依据", "推导", "结果", "阅卷要点"])
        if (!solution.includes("### " + h + "\n"))
          throw Error(q.id + "缺少" + h);
      const images = [...solution.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(
        (m) => m[1].replace("../../public/", "").replace("./", ""),
      );
      const figures = q.figures?.length
        ? q.figures
        : q.figure
          ? [{ src: q.figure, alt: q.title + "示意图" }]
          : [];
      const proof = provenance[index];
      if (
        proof.verified !== true ||
        proof.sourceIdentity !== source.identity ||
        proof.promptSha256 !== sha256(q.prompt)
      )
        throw Error("题面或题源与已复核清单不符 " + q.id);
      if (
        !Array.isArray(proof.figures) ||
        JSON.stringify(proof.figures.map((f) => f.src)) !==
          JSON.stringify(figures.map((f) => f.src))
      )
        throw Error("题图顺序与已复核清单不符 " + q.id);
      for (const image of [...images, ...figures.map((f) => f.src)]) {
        if (!/^figures\/(?:[\w-]+\/)*[\w.-]+\.(?:png|webp|svg)$/i.test(image))
          throw Error("非法图像 " + image);
        await access(new URL("public/" + image, root));
      }
      for (const figure of proof.figures)
        if (
          figure.sha256 !==
          sha256(await readFile(new URL("public/" + figure.src, root)))
        )
          throw Error("题图与已复核清单不符 " + q.id + ":" + figure.src);
      return {
        ...q,
        figures,
        source: {
          section: category.name,
          page,
          identity: source.identity,
        },
        variants: [
          {
            id: "common",
            revision: solutionRevision,
            solution: solution.replaceAll(
              "../../public/figures/",
              "./figures/",
            ),
          },
        ],
      };
    },
  ),
);
const bank = {
  bankVersion: meta.bankVersion,
  categories: meta.categories.map(({ id, name }) => ({ id, name })),
  rules: (await read("sources/rules.md")).trim(),
  questions,
};
await mkdir(new URL("src/data/", root), { recursive: true });
await writeFile(
  new URL("src/data/bank.json", root),
  JSON.stringify(bank, null, 2) + "\n",
);
console.log(
  "Generated " +
    questions.length +
    " course exercises in " +
    bank.categories.length +
    " chapters",
);
