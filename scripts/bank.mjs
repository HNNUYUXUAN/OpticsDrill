import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const rows = JSON.parse(await read("sources/questions.json"));
const meta = JSON.parse(await read("sources/meta.json"));
const ids = rows.map((q) => q.id);
if (
  new Set(ids).size !== ids.length ||
  JSON.stringify(ids) !== JSON.stringify(meta.courseIds)
)
  throw Error("题号清单与课程范围不一致");
const questions = await Promise.all(
  rows.map(async ({ page, ...q }) => {
    const category = meta.categories.find((c) => c.id === q.categoryId);
    if (!category || !page) throw Error("缺少模块或来源 " + q.id);
    const solution = (await read("sources/solutions/" + q.id + ".md")).trim();
    for (const h of ["已知与求解", "依据", "推导", "结果", "阅卷要点"])
      if (!solution.includes("### " + h + "\n")) throw Error(q.id + "缺少" + h);
    const images = [...solution.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(
      (m) => m[1].replace("../../public/", "").replace("./", ""),
    );
    for (const image of [...images, ...(q.figure ? [q.figure] : [])]) {
      if (!/^figures\/[\w.-]+\.svg$/.test(image))
        throw Error("非法图像 " + image);
      await access(new URL("public/" + image, root));
    }
    return {
      ...q,
      source: {
        section: category.name,
        page,
        identity: createHash("sha256")
          .update(q.id + "\n" + q.prompt)
          .digest("hex"),
      },
      variants: [
        {
          id: "common",
          revision: 1,
          solution: solution.replaceAll("../../public/figures/", "./figures/"),
        },
      ],
    };
  }),
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
