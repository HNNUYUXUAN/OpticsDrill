import { z } from "zod";
import bankData from "./data/bank.json";
const variantSchema = z.object({
  id: z.enum(["common", "primary", "alternate"]),
  solution: z.string().min(1),
  revision: z.number().int().positive(),
});
export const bankSchema = z
  .object({
    bankVersion: z.number().int().positive(),
    rules: z.string(),
    categories: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
    questions: z
      .array(
        z.object({
          id: z.string().min(1),
          categoryId: z.string(),
          title: z.string().min(1),
          prompt: z.string().min(1),
          figure: z.string().regex(/^(?:figures\/[\w.-]+\.svg)?$/),
          check: z.string().min(1),
          expected: z.string().min(1),
          result: z.string().min(1),
          judgment: z.object({
            correct: z.string().min(1),
            incorrect: z.string().min(1),
            reason: z.string().min(1),
          }),
          tags: z.array(z.string()),
          source: z.object({
            section: z.string().min(1),
            page: z.string().min(1),
            identity: z.string().min(1),
          }),
          variants: z.array(variantSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((b, c) => {
    if (new Set(b.questions.map((q) => q.id)).size !== b.questions.length)
      c.addIssue({ code: "custom", message: "题目 ID 重复" });
    for (const q of b.questions) {
      if (!b.categories.some((x) => x.id === q.categoryId))
        c.addIssue({ code: "custom", message: "模块不存在" });
      const ids = q.variants.map((v) => v.id);
      if (!(
        (ids.length === 1 && ids[0] === "common") ||
        (ids.length === 2 &&
          ids.includes("primary") &&
          ids.includes("alternate"))
      ))
        c.addIssue({ code: "custom", message: "答案版本不完整" });
    }
  });
export type Bank = z.infer<typeof bankSchema>;
export type Question = Bank["questions"][number];
export type Profile = "primary" | "alternate";
export type Mode = "input" | "paper" | "syntax";
export type Result = "correct" | "uncertain" | "wrong";
export const bank = bankSchema.parse(bankData);
export const answer = (q: Question, p: Profile) =>
  q.variants.find((v) => v.id === p) || q.variants[0];
export const key = (q: Question, p: Profile) => q.id + ":" + answer(q, p).id;
export const day = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const progressSchema = z.object({
  revision: z.number(),
  streak: z.number(),
  due: z.string(),
  wrong: z.number(),
  uncertain: z.number(),
  retries: z.number(),
  active: z.boolean(),
  last: z.string(),
  lastWrong: z.string(),
  result: z.enum(["correct", "uncertain", "wrong"]),
});
const attemptSchema = z.object({
  id: z.string(),
  qid: z.string(),
  key: z.string(),
  revision: z.number(),
  mode: z.enum(["input", "paper", "syntax"]),
  result: z.enum(["correct", "uncertain", "wrong"]),
  time: z.string(),
  day: z.string(),
  input: z.string(),
  match: z.boolean().nullable(),
});
const configSchema = z.object({
  profile: z.enum(["primary", "alternate"]),
  mode: z.enum(["input", "paper", "syntax"]),
  filter: z.enum(["all", "wrong", "unseen", "due"]),
  category: z.string(),
  tag: z.string(),
  order: z.enum(["random", "source"]),
  length: z.number().int().min(0).max(10000),
});
export type Config = z.infer<typeof configSchema>;
const sessionSchema = z.object({
  config: configSchema,
  pool: z.array(z.string()),
  remaining: z.array(z.string()),
  qid: z.string(),
  attemptId: z.string(),
  draft: z.string(),
  revealed: z.boolean(),
  rated: z.boolean(),
  done: z.number(),
  finished: z.boolean(),
  snippet: z.string(),
  isOriginal: z.boolean(),
  syntaxReason: z.string(),
  choice: z.boolean().nullable(),
});
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    app: z.literal("OpticsDrill"),
    bank: bankSchema,
    attempts: z.array(attemptSchema),
    progress: z.record(z.string(), progressSchema),
    settings: z.object({
      profile: z.enum(["primary", "alternate"]),
      strict: z.boolean(),
      autoNext: z.boolean(),
    }),
    session: sessionSchema.nullable(),
  })
  .superRefine((s, c) => {
    if (new Set(s.attempts.map((a) => a.id)).size !== s.attempts.length)
      c.addIssue({ code: "custom", message: "记录 ID 重复" });
    if (
      s.session &&
      [s.session.qid, ...s.session.pool, ...s.session.remaining].some(
        (id) => !s.bank.questions.some((q) => q.id === id),
      )
    )
      c.addIssue({ code: "custom", message: "会话题目缺失" });
    if (
      s.session &&
      (!s.session.pool.length ||
        s.session.done < 0 ||
        !s.session.pool.includes(s.session.qid))
    )
      c.addIssue({ code: "custom", message: "会话队列无效" });
  });
export type State = z.infer<typeof stateSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type Progress = z.infer<typeof progressSchema>;
export const initial = (): State => ({
  schemaVersion: 1,
  app: "OpticsDrill",
  bank,
  attempts: [],
  progress: {},
  settings: { profile: "primary", strict: false, autoNext: true },
  session: null,
});
export const STORAGE = "opticsdrill.v1";
export function restoreState(saved: State): State {
  const bundled =
    saved.bank.questions.length === bank.questions.length &&
    saved.bank.questions.every((q) =>
      bank.questions.some(
        (fresh) =>
          fresh.id === q.id && fresh.source.identity === q.source.identity,
      ),
    );
  return bundled && saved.bank.bankVersion < bank.bankVersion
    ? upgradeBank(saved, bank)
    : saved;
}
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE);
    const saved = raw ? stateSchema.parse(JSON.parse(raw)) : initial();
    return {
      state: restoreState(saved),
      error: "",
    };
  } catch {
    return {
      state: initial(),
      error: "本地数据读取失败。原数据仍保留，请先导出损坏数据或恢复备份。",
    };
  }
}
function tokens(value: string) {
  return (
    value
      .replace(/[²³]/g, (c) => (c === "²" ? "^2" : "^3"))
      .normalize("NFKC")
      .replace(/[×·⋅]/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "pi")
      .match(/[A-Za-z][A-Za-z0-9]*|[0-9]+(?:\.[0-9]+)?|[^\s]/g) ?? []
  );
}

export function compare(input: string, reference: string, strict = false) {
  return strict
    ? input.trim() === reference.trim()
    : JSON.stringify(tokens(input)) === JSON.stringify(tokens(reference));
}

export function submitAnswer(s: State): State {
  const session = s.session;
  if (!session || session.revealed || session.finished) return s;
  if (session.config.mode === "syntax" && session.choice === null) return s;
  const q = s.bank.questions.find((q) => q.id === session.qid)!;
  const revealed = { ...s, session: { ...session, revealed: true } };
  return session.config.mode === "input" &&
    session.draft.trim() &&
    compare(session.draft, q.expected, s.settings.strict)
    ? rate(revealed, "correct")
    : revealed;
}

export function correctionHint(input: string, reference: string) {
  const actual = tokens(input);
  const expected = tokens(reference);
  const index = expected.findIndex((token, i) => token !== actual[i]);
  if (index < 0 && actual.length === expected.length) {
    return "严格模式下，请核对内部空格和符号写法。";
  }
  const at = index < 0 ? expected.length : index;
  return (
    "第 " +
    (at + 1) +
    " 个符号可先核对。你的写法是「" +
    (actual[at] ?? "缺少内容") +
    "」，参考写法是「" +
    (expected[at] ?? "表达式结束") +
    "」。"
  );
}

function syntax(q: Question, rng = Math.random) {
  const isOriginal = rng() < 0.5;
  return {
    snippet: isOriginal ? q.judgment.correct : q.judgment.incorrect,
    isOriginal,
    syntaxReason: q.judgment.reason,
  };
}
export function eligible(s: State, c: Config) {
  return s.bank.questions.filter((q) => {
    const p =
      s.progress[(c.mode === "syntax" ? "syntax:" : "") + key(q, c.profile)];
    return (
      (!c.category || q.categoryId === c.category) &&
      (!c.tag || q.tags.includes(c.tag)) &&
      (c.filter === "all" ||
        (c.filter === "wrong" && p?.active) ||
        (c.filter === "unseen" && !p) ||
        (c.filter === "due" && p && p.due <= day()))
    );
  });
}
export function order(
  s: State,
  c: Config,
  ids: string[],
  rng = Math.random,
  last = "",
) {
  const pool = [...ids],
    out: string[] = [];
  while (pool.length) {
    let index = 0;
    if (c.order === "random") {
      const weights = pool.map((id) => {
        const q = s.bank.questions.find((q) => q.id === id)!;
        const p =
          s.progress[
            (c.mode === "syntax" ? "syntax:" : "") + key(q, c.profile)
          ];
        return (
          (p ? (p.streak >= 3 ? 1 : p.result === "correct" ? 3 : 6) : 3) +
          (p && p.due <= day() ? 3 : 0)
        );
      });
      let target = rng() * weights.reduce((a, b) => a + b, 0);
      index = weights.findIndex((w) => (target -= w) < 0);
      if (index < 0) index = pool.length - 1;
    }
    out.push(pool.splice(index, 1)[0]);
  }
  if (out.length > 1 && out[0] === last) [out[0], out[1]] = [out[1], out[0]];
  return out;
}
function card(s: State, session: NonNullable<State["session"]>, qid: string) {
  const q = s.bank.questions.find((q) => q.id === qid)!;
  return {
    ...session,
    qid,
    attemptId: crypto.randomUUID(),
    draft: "",
    revealed: false,
    rated: false,
    choice: null,
    ...(session.config.mode === "syntax" ? syntax(q) : {}),
  };
}
export function start(s: State, c: Config, questionId?: string): State {
  const pool = eligible(s, c)
    .filter((q) => !questionId || q.id === questionId)
    .map((q) => q.id);
  if (!pool.length) return s;
  const list = order(s, c, pool);
  const session = {
    config: c,
    pool,
    remaining: list.slice(1),
    qid: list[0],
    attemptId: "",
    draft: "",
    revealed: false,
    rated: false,
    done: 0,
    finished: false,
    snippet: "",
    isOriginal: true,
    syntaxReason: "",
    choice: null,
  };
  return { ...s, session: card(s, session, list[0]) };
}
export function next(s: State): State {
  const a = s.session;
  if (!a || !a.rated) return s;
  if (a.config.length && a.done >= a.config.length)
    return { ...s, session: { ...a, finished: true } };
  const remaining = a.remaining.length
    ? a.remaining
    : order(s, a.config, a.pool, Math.random, a.qid);
  return {
    ...s,
    session: card(s, { ...a, remaining: remaining.slice(1) }, remaining[0]),
  };
}
export function rate(s: State, result: Result, now = new Date()): State {
  const a = s.session;
  if (
    !a ||
    !a.revealed ||
    a.rated ||
    s.attempts.some((x) => x.id === a.attemptId)
  )
    return s;
  const q = s.bank.questions.find((q) => q.id === a.qid)!;
  const v = answer(q, a.config.profile);
  const k =
    (a.config.mode === "syntax" ? "syntax:" : "") + key(q, a.config.profile);
  const old = s.progress[k];
  const streak =
    result === "correct"
      ? (old?.revision === v.revision ? old.streak : 0) + 1
      : 0;
  const due = new Date(now);
  due.setDate(
    due.getDate() +
      (result === "wrong"
        ? 0
        : result === "uncertain"
          ? 1
          : [1, 3, 7, 14][Math.min(streak - 1, 3)]),
  );
  const progress: Progress = {
    revision: v.revision,
    streak,
    due: day(due),
    wrong: (old?.wrong || 0) + (result === "wrong" ? 1 : 0),
    uncertain: (old?.uncertain || 0) + (result === "uncertain" ? 1 : 0),
    retries:
      (old?.retries || 0) + (old && old.wrong + old.uncertain > 0 ? 1 : 0),
    active: result !== "correct" || !!old?.active,
    last: now.toISOString(),
    lastWrong: result === "wrong" ? now.toISOString() : old?.lastWrong || "",
    result,
  };
  const attempt: Attempt = {
    id: a.attemptId,
    qid: q.id,
    key: k,
    revision: v.revision,
    mode: a.config.mode,
    result,
    time: now.toISOString(),
    day: day(now),
    input: a.draft,
    match:
      a.config.mode === "syntax"
        ? a.choice === a.isOriginal
        : a.draft
          ? compare(a.draft, q.expected, s.settings.strict)
          : null,
  };
  const updated = {
    ...s,
    progress: { ...s.progress, [k]: progress },
    attempts: [...s.attempts, attempt],
    session: { ...a, rated: true, done: a.done + 1 },
  };
  return s.settings.autoNext ? next(updated) : updated;
}
export function stats(s: State, category = "") {
  const qs = s.bank.questions.filter(
    (q) => !category || q.categoryId === category,
  );
  const keys = new Set(qs.map((q) => key(q, s.settings.profile)));
  const attempts = s.attempts.filter(
    (a) => a.mode !== "syntax" && keys.has(a.key),
  );
  const progress = qs.map((q) => s.progress[key(q, s.settings.profile)]);
  return {
    total: qs.length,
    attempts: attempts.length,
    correct: attempts.filter((a) => a.result === "correct").length,
    today: attempts.filter((a) => a.day === day()).length,
    seen: progress.filter(Boolean).length,
    mastered: qs.filter((q) => {
      const p = s.progress[key(q, s.settings.profile)];
      return (
        p &&
        p.revision === answer(q, s.settings.profile).revision &&
        p.streak >= 3
      );
    }).length,
    wrong: progress.filter((p) => p?.active).length,
    due: progress.filter((p) => p && p.due <= day()).length,
  };
}
export function importData(raw: string): {
  type: "backup" | "bank";
  data: State | Bank;
} {
  const data = JSON.parse(raw);
  return data && typeof data === "object" && "schemaVersion" in data
    ? { type: "backup", data: restoreState(stateSchema.parse(data)) }
    : { type: "bank", data: bankSchema.parse(data) };
}
export function replaceBank(s: State, b: Bank): State {
  const progress = { ...s.progress };
  for (const q of b.questions)
    for (const v of q.variants)
      for (const prefix of ["", "syntax:"]) {
        const k = prefix + q.id + ":" + v.id;
        const p = progress[k];
        if (p && p.revision !== v.revision)
          progress[k] = { ...p, streak: 0, due: day(), revision: v.revision };
      }
  return { ...s, bank: b, progress, session: null };
}
export function upgradeBank(s: State, b: Bank): State {
  const updated = replaceBank(s, b);
  const session = s.session;
  if (
    session &&
    session.pool.every((id) => {
      const old = s.bank.questions.find((q) => q.id === id);
      const fresh = b.questions.find((q) => q.id === id);
      if (!old || !fresh) return false;
      const a = answer(old, session.config.profile),
        v = answer(fresh, session.config.profile);
      return (
        a.id === v.id &&
        a.revision === v.revision &&
        old.expected === fresh.expected
      );
    })
  )
    updated.session = session;
  return updated;
}
