import { Overview } from "./Overview";
import { StatsDetails } from "./StatsDetails";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  BookOpen,
  ArrowRight,
  Layers,
  RotateCcw,
  ChartNoAxesCombined,
  Settings,
  LayoutDashboard,
  Check,
  Copy,
  DraftingCompass,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./academic.css";
import { Store, useStore } from "./store";
import {
  answer,
  key,
  stats,
  start,
  rate,
  next,
  day,
  importData,
  replaceBank,
  initial,
  STORAGE,
  compare,
  submitAnswer,
  correctionHint,
  type Config,
  type Question,
  type Profile,
  type State,
  type Bank,
} from "./core";
function MathText({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      skipHtml
      components={{
        img: ({ src, alt }) => (
          <img
            src={
              src?.startsWith("./figures/")
                ? import.meta.env.BASE_URL + src.slice(2)
                : src
            }
            alt={alt}
            className="study-figure"
          />
        ),
      }}
    >
      {text}
    </Markdown>
  );
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Code({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <button
        className="copy"
        aria-label="复制参考写法"
        onClick={() => {
          navigator.clipboard
            .writeText(text)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <pre>{text}</pre>
    </div>
  );
}
function Prompt({ q }: { q: Question }) {
  return (
    <div className="prompt">
      <MathText text={q.prompt} />
      {q.figure && (
        <img
          className="study-figure"
          src={import.meta.env.BASE_URL + q.figure}
          alt={q.title + "示意图"}
        />
      )}
    </div>
  );
}

function Reference({
  q,
  profile,
  showCheck = false,
}: {
  q: Question;
  profile: Profile;
  showCheck?: boolean;
}) {
  const variant = answer(q, profile);
  return (
    <>
      <div className="eyebrow">参考结论</div>
      <div className="reference-answer">
        <MathText text={q.result} />
        {showCheck && (
          <>
            <p className="eyebrow">关键结果的输入写法</p>
            <Code text={q.expected} />
          </>
        )}
      </div>
      <details className="explanation">
        <summary>展开规范解答与阅卷要点</summary>
        <div className="solution">
          <MathText text={variant.solution} />
        </div>
      </details>
      <details>
        <summary>题源与改编说明</summary>
        <p>
          姚启钧原著《光学教程》（第六版） · {q.source.section} ·{" "}
          {q.source.page} · {q.id} 题
        </p>
        <p>题意经转述，参考推导依据本项目的习题整理材料。</p>
      </details>
    </>
  );
}
const defaults: Config = {
  profile: "primary",
  mode: "input",
  filter: "all",
  category: "",
  tag: "",
  order: "random",
  length: 10,
};
function App() {
  const { state: s, update, error } = useStore();
  const [page, setPage] = useState(
    s.session && !s.session.finished ? "drill" : "overview",
  );
  const [config, setConfig] = useState<Config>(defaults);
  const [detail, setDetail] = useState<Question | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [wrongMode, setWrongMode] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof importData> | null>(
    null,
  );
  const st = stats(s);
  const nav = [
    ["overview", "总览", LayoutDashboard],
    ["drill", "快速训练", BookOpen],
    ["categories", "题库模块", Layers],
    ["wrong", "错题本", RotateCcw],
    ["statistics", "学习统计", ChartNoAxesCombined],
    ["settings", "设置与数据", Settings],
  ] as const;
  function launch(overrides: Partial<Config> = {}, questionId?: string) {
    const cfg = { ...config, profile: s.settings.profile, ...overrides };
    const n = start(s, cfg, questionId);
    if (n === s) {
      setMessage("当前筛选没有可练习的题目。");
      return;
    }
    if (
      s.session &&
      !s.session.finished &&
      !confirm("开始新训练将结束当前会话，已完成记录会保留。")
    )
      return;
    update(() => n);
    setPage("drill");
    setDetail(null);
    setMessage("");
  }
  const accuracy = st.attempts
    ? Math.round((100 * st.correct) / st.attempts) + "%"
    : "—";
  const session = s.session;
  const q = session
    ? s.bank.questions.find((q) => q.id === session.qid)
    : undefined;
  function updateSession(p: Partial<NonNullable<State["session"]>>) {
    update((x) => ({
      ...x,
      session: x.session ? { ...x.session, ...p } : null,
    }));
  }
  function questionRows(questions: Question[]) {
    return (
      <div className="rows">
        {questions.map((q) => {
          const p =
            s.progress[
              (wrongMode && page === "wrong" ? "syntax:" : "") +
                key(q, s.settings.profile)
            ];
          return (
            <div className="question-row" key={q.id}>
              <button className="question-title" onClick={() => setDetail(q)}>
                <small>
                  {q.id} ·{" "}
                  {s.bank.categories.find((c) => c.id === q.categoryId)?.name}
                </small>
                <MathText text={q.title} />
              </button>
              <div className="row-state">
                {p ? (
                  <>
                    <span>
                      {p.streak >= 3
                        ? "已掌握"
                        : p.result === "correct"
                          ? "练习中"
                          : "不熟悉"}
                    </span>
                    <small>
                      错误 {p.wrong} · 不确定 {p.uncertain} · 重做 {p.retries}
                    </small>
                    <small>{new Date(p.last).toLocaleString()}</small>
                  </>
                ) : (
                  <span>未练习</span>
                )}
              </div>
              {page === "wrong" && (
                <button
                  className="text-button"
                  onClick={() =>
                    update((x) => {
                      const k =
                        (wrongMode ? "syntax:" : "") +
                        key(q, x.settings.profile);
                      return {
                        ...x,
                        progress: {
                          ...x.progress,
                          [k]: { ...x.progress[k], active: false },
                        },
                      };
                    })
                  }
                >
                  移出
                </button>
              )}
            </div>
          );
        })}
        {!questions.length && (
          <div className="empty">
            这里还没有题目。完成一次训练后，记录会出现在这里。
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="app">
      <aside aria-label="站点导航">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <DraftingCompass />
          <span>
            OpticsDrill<small>OPTICS</small>
          </span>
        </a>
        <div className="sidebar-label">学习空间</div>
        <nav aria-label="主要导航">
          {nav.map(([id, label, Icon]) => (
            <button
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                setMessage("");
              }}
              key={id}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "wrong" && st.wrong > 0 && <b>{st.wrong}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="dot" /> 本地学习空间
          <small>专注每一次提取与回忆。</small>
        </div>
      </aside>
      <main>
        <header>
          <span>光学 / {nav.find((n) => n[0] === page)?.[1]}</span>
        </header>
        {error && (
          <div role="alert" className="alert">
            尚未保存：{error}{" "}
            <button onClick={() => download("opticsdrill-recovery.json", s)}>
              导出当前数据
            </button>
          </div>
        )}
        {message && (
          <div role="status" className="note">
            {message}
          </div>
        )}
        {page === "overview" && (
          <Overview
            state={s}
            onStart={launch}
            onResume={() => setPage("drill")}
            onBrowse={() => setPage("categories")}
          />
        )}
        {page === "drill" && (
          <>
            <div className="page-heading compact">
              <h1>快速训练</h1>
              <p>先独立回忆，再查看参考答案。</p>
            </div>
            {session && !session.finished && q ? (
              <>
                <div className="session-meta">
                  <span>
                    {session.config.mode === "paper"
                      ? "纸笔默写"
                      : session.config.mode === "syntax"
                        ? "易错辨析"
                        : "输入速刷"}
                  </span>
                  <span>
                    {session.done} / {session.config.length || "∞"} 已完成{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        if (confirm("结束本轮训练？已完成记录会保留。"))
                          update((x) => ({ ...x, session: null }));
                      }}
                    >
                      结束
                    </button>
                  </span>
                </div>
                <article className="practice">
                  <div className="eyebrow">
                    {q.id} /{" "}
                    {s.bank.categories.find((c) => c.id === q.categoryId)?.name}
                  </div>
                  <Prompt q={q} />
                  {session.config.mode === "input" && (
                    <>
                      <div className="note">
                        <MathText text={q.check} />
                      </div>
                      <label htmlFor="answer-input">你的关键结果</label>
                      <textarea
                        id="answer-input"
                        spellCheck={false}
                        value={session.draft}
                        onChange={(e) =>
                          updateSession({ draft: e.target.value })
                        }
                        placeholder="输入数字或表达式。乘法用 *，乘方用 ^。"
                        disabled={session.revealed}
                      />
                    </>
                  )}
                  {session.config.mode === "paper" && (
                    <div className="paper-note">
                      在纸上写出完整推导，完成后揭示参考答案并自评。
                    </div>
                  )}
                  {session.config.mode === "syntax" && (
                    <>
                      <p>以下列式或判断是否符合本题条件？</p>
                      <div className="note">
                        <MathText text={session.snippet} />
                      </div>
                      <div className="actions">
                        <button
                          disabled={session.revealed}
                          className={session.choice === true ? "selected" : ""}
                          onClick={() => updateSession({ choice: true })}
                        >
                          符合
                        </button>
                        <button
                          disabled={session.revealed}
                          className={session.choice === false ? "selected" : ""}
                          onClick={() => updateSession({ choice: false })}
                        >
                          有问题
                        </button>
                      </div>
                    </>
                  )}
                  <div className="answer-zone">
                    {!session.revealed ? (
                      <button
                        className="primary"
                        disabled={
                          session.config.mode === "syntax" &&
                          session.choice === null
                        }
                        onClick={() => {
                          const matched =
                            session.config.mode === "input" &&
                            session.draft.trim() &&
                            compare(
                              session.draft,
                              q.expected,
                              s.settings.strict,
                            );
                          setMessage(
                            matched
                              ? `${q.id} 与参考写法匹配，已通过。${s.settings.autoNext ? "继续下一题。" : "记录已保存。"}`
                              : "",
                          );
                          update(submitAnswer);
                        }}
                      >
                        {session.config.mode === "input" && session.draft.trim()
                          ? "提交并检查"
                          : "显示参考答案"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <>
                        {session.config.mode === "syntax" ? (
                          <div className="note">
                            {session.choice === session.isOriginal
                              ? "判断正确"
                              : "判断有差异"}{" "}
                            <MathText text={session.syntaxReason} />
                          </div>
                        ) : (
                          session.draft && (
                            <div
                              className={
                                compare(
                                  session.draft,
                                  q.expected,
                                  s.settings.strict,
                                )
                                  ? "feedback pass"
                                  : "feedback correction"
                              }
                              role="status"
                            >
                              {compare(
                                session.draft,
                                q.expected,
                                s.settings.strict,
                              ) ? (
                                "✓ 与参考写法匹配，已通过。"
                              ) : (
                                <>
                                  可对照参考写法订正。
                                  <p>
                                    {correctionHint(session.draft, q.expected)}
                                  </p>
                                  <small>
                                    等价表达式可以自评。完整推导可按阅卷要点核对。
                                  </small>
                                </>
                              )}
                            </div>
                          )
                        )}
                        <Reference
                          q={q}
                          profile={session.config.profile}
                          showCheck={session.config.mode === "input"}
                        />
                        {!session.rated ? (
                          <div className="assessment">
                            <p>这次掌握得怎样？</p>
                            <div className="actions">
                              <button
                                className="primary"
                                onClick={() =>
                                  update((x) => rate(x, "correct"))
                                }
                              >
                                掌握了
                              </button>
                              <button
                                onClick={() =>
                                  update((x) => rate(x, "uncertain"))
                                }
                              >
                                不确定
                              </button>
                              <button
                                className="danger-text"
                                onClick={() => update((x) => rate(x, "wrong"))}
                              >
                                答错了
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="primary"
                            onClick={() => update(next)}
                          >
                            下一题 <ArrowRight size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              </>
            ) : (
              <>
                {session?.finished && (
                  <div className="note">
                    本轮已完成 {session.done} 次练习，记录已保存。继续巩固吧。
                  </div>
                )}
                <section className="panel">
                  <h2>安排这一轮练习</h2>
                  <div className="form-grid">
                    <label>
                      训练方式
                      <select
                        value={config.mode}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            mode: e.target.value as Config["mode"],
                          })
                        }
                      >
                        <option value="input">输入速刷</option>
                        <option value="paper">纸笔默写</option>
                        <option value="syntax">易错辨析</option>
                      </select>
                    </label>
                    <label>
                      题目范围
                      <select
                        value={config.filter}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            filter: e.target.value as Config["filter"],
                          })
                        }
                      >
                        {[
                          ["all", "全部题目"],
                          ["wrong", "只刷错题"],
                          ["unseen", "尚未练习"],
                          ["due", "到期复习"],
                        ].map(([v, t]) => (
                          <option value={v} key={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      模块
                      <select
                        value={config.category}
                        onChange={(e) =>
                          setConfig({ ...config, category: e.target.value })
                        }
                      >
                        <option value="">全部模块</option>
                        {s.bank.categories.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      知识点标签
                      <select
                        value={config.tag}
                        onChange={(e) =>
                          setConfig({ ...config, tag: e.target.value })
                        }
                      >
                        <option value="">全部标签</option>
                        {[...new Set(s.bank.questions.flatMap((q) => q.tags))]
                          .sort()
                          .map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                      </select>
                    </label>
                    <label>
                      顺序
                      <select
                        value={config.order}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            order: e.target.value as Config["order"],
                          })
                        }
                      >
                        <option value="random">加权随机</option>
                        <option value="source">原题顺序</option>
                      </select>
                    </label>
                    <label>
                      题量（0 为无限）
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={config.length}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            length: Math.min(
                              10000,
                              Math.max(0, Math.floor(+e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="actions">
                    {[10, 20, 50, 0].map((n) => (
                      <button
                        key={n}
                        className={config.length === n ? "selected" : ""}
                        onClick={() => setConfig({ ...config, length: n })}
                      >
                        {n || "无限"}
                      </button>
                    ))}
                  </div>
                  <button className="primary" onClick={() => launch()}>
                    开始这一轮 <ArrowRight size={18} />
                  </button>
                </section>
                <details className="panel">
                  <summary>考试书写规范</summary>
                  <MathText text={s.bank.rules} />
                </details>
              </>
            )}
          </>
        )}
        {page === "categories" && (
          <>
            <div className="page-heading compact">
              <h1>题库模块</h1>
              <p>按章节或知识点查找习题，查看题源与规范解答。</p>
            </div>
            <div className="actions">
              <input
                aria-label="搜索题目"
                placeholder="搜索题目、知识点或题号……"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {s.bank.categories.map((c) => (
              <section key={c.id}>
                <div className="section-heading">
                  <h2>
                    {c.id} / {c.name}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() =>
                      launch({ category: c.id, tag: "", filter: "all" })
                    }
                  >
                    练习本模块 →
                  </button>
                </div>
                {questionRows(
                  s.bank.questions.filter(
                    (q) =>
                      q.categoryId === c.id &&
                      [q.id, q.title, q.prompt, ...q.tags]
                        .join(" ")
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ),
                )}
              </section>
            ))}
          </>
        )}
        {page === "wrong" && (
          <>
            <div className="page-heading compact">
              <h1>错题本</h1>
              <p>留下薄弱点，让下一次练习更有针对性。</p>
            </div>
            <div className="actions">
              <button
                className={!wrongMode ? "selected" : ""}
                onClick={() => setWrongMode(false)}
              >
                整题练习
              </button>
              <button
                className={wrongMode ? "selected" : ""}
                onClick={() => setWrongMode(true)}
              >
                易错辨析
              </button>
              <button
                className="primary"
                onClick={() =>
                  launch({
                    filter: "wrong",
                    category: "",
                    tag: "",
                    mode: wrongMode ? "syntax" : "input",
                    length: 0,
                  })
                }
              >
                错题回炉
              </button>
              <button
                onClick={() =>
                  launch({
                    filter: "wrong",
                    category: "",
                    tag: "",
                    mode: wrongMode ? "syntax" : "input",
                    length: 10,
                  })
                }
              >
                随机 10 题
              </button>
            </div>
            {questionRows(
              s.bank.questions.filter(
                (q) =>
                  s.progress[
                    (wrongMode ? "syntax:" : "") + key(q, s.settings.profile)
                  ]?.active,
              ),
            )}
          </>
        )}
        {page === "statistics" && (
          <>
            <div className="page-heading compact">
              <h1>学习统计</h1>
              <p>按模块查看练习次数、正确率和复习进度。</p>
            </div>
            <div className="metrics">
              {[
                ["完成次数", st.attempts],
                ["正确率", accuracy],
                ["已掌握", st.mastered],
                ["待复习", st.due],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <h2>模块表现</h2>
              {s.bank.categories.map((c) => {
                const t = stats(s, c.id);
                return (
                  <div className="stat-row" key={c.id}>
                    <span>{c.name}</span>
                    <div className="bar">
                      <i
                        style={{
                          width: `${t.attempts ? (100 * t.correct) / t.attempts : 0}%`,
                        }}
                      />
                    </div>
                    <span>
                      {t.attempts
                        ? Math.round((100 * t.correct) / t.attempts) + "%"
                        : "—"}{" "}
                      · {t.attempts} 次
                    </span>
                  </div>
                );
              })}
            </section>
            <section className="panel">
              <h2>每日练习</h2>
              {!s.attempts.length ? (
                <p>完成第一轮训练后，查看每日记录。</p>
              ) : (
                [...new Set(s.attempts.map((a) => a.day))]
                  .sort()
                  .reverse()
                  .slice(0, 14)
                  .map((d) => (
                    <div className="stat-row" key={d}>
                      <span>{d}</span>
                      <span>
                        {s.attempts.filter((a) => a.day === d).length}{" "}
                        次（含辨析）
                      </span>
                    </div>
                  ))
              )}
            </section>
            <StatsDetails state={s} />
            <section className="panel">
              <h2>最近记录</h2>
              <p>
                易错辨析：{s.attempts.filter((a) => a.mode === "syntax").length}{" "}
                次 · 正确{" "}
                {
                  s.attempts.filter(
                    (a) => a.mode === "syntax" && a.result === "correct",
                  ).length
                }{" "}
                次
              </p>
              {s.attempts
                .slice(-20)
                .reverse()
                .map((a) => (
                  <div className="stat-row" key={a.id}>
                    <span>
                      {a.qid} ·{" "}
                      {a.mode === "syntax"
                        ? "辨析"
                        : a.mode === "paper"
                          ? "默写"
                          : "输入"}
                    </span>
                    <span>
                      {a.result === "correct"
                        ? "掌握了"
                        : a.result === "wrong"
                          ? "答错了"
                          : "不确定"}
                    </span>
                    <small>{new Date(a.time).toLocaleString()}</small>
                  </div>
                ))}
            </section>
          </>
        )}
        {page === "settings" && (
          <>
            <div className="page-heading compact">
              <h1>设置与数据</h1>
              <p>学习记录保存在当前浏览器，定期备份，让进度始终在手。</p>
            </div>
            <section className="panel">
              <h2>训练偏好</h2>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={s.settings.strict}
                  onChange={(e) =>
                    update((x) => ({
                      ...x,
                      settings: { ...x.settings, strict: e.target.checked },
                    }))
                  }
                />
                严格比较（保留内部空白）
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={s.settings.autoNext}
                  onChange={(e) =>
                    update((x) => ({
                      ...x,
                      settings: { ...x.settings, autoNext: e.target.checked },
                    }))
                  }
                />
                自评后自动进入下一题
              </label>
              <p>
                输入速刷核对指定的关键结果，纸笔默写按解答中的阅卷要点自评。
              </p>
            </section>
            <section className="panel">
              <h2>备份与恢复</h2>
              <p>
                备份包含题库、全部练习历史、设置和当前会话。学习记录保存在当前浏览器中，换设备时可通过备份恢复。
              </p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={() =>
                    download("opticsdrill-backup-" + day() + ".json", s)
                  }
                >
                  导出完整备份
                </button>
                <button
                  onClick={() => download("opticsdrill-bank.json", s.bank)}
                >
                  导出题库
                </button>
              </div>
              <label>
                导入题库或完整备份
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 20 * 1024 * 1024)
                        throw Error("文件超过 20 MB");
                      setPending(importData(await f.text()));
                      setMessage("");
                    } catch (err) {
                      setMessage(
                        "导入失败：" +
                          (err instanceof Error ? err.message : "文件无效"),
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {pending && (
                <div className="note">
                  <p>
                    将导入
                    {pending.type === "backup"
                      ? "完整备份（替换所有当前记录）"
                      : "题库（保留历史并结束当前会话）"}
                    ，共{" "}
                    {pending.type === "bank"
                      ? (pending.data as Bank).questions.length
                      : (pending.data as State).bank.questions.length}{" "}
                    题。
                  </p>
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() => {
                        update(
                          (x) =>
                            pending.type === "backup"
                              ? (pending.data as State)
                              : replaceBank(x, pending.data as Bank),
                          true,
                        );
                        setPending(null);
                        setMessage("导入完成。");
                      }}
                    >
                      确认导入
                    </button>
                    <button onClick={() => setPending(null)}>取消</button>
                  </div>
                </div>
              )}
            </section>
            <section className="panel">
              <h2>数据维护</h2>
              <button
                className="danger-text"
                onClick={() => {
                  if (confirm("清除所有练习记录与当前会话？题库和设置保留。"))
                    update((x) => ({
                      ...initial(),
                      bank: x.bank,
                      settings: x.settings,
                    }));
                }}
              >
                重置练习数据
              </button>
              {error && (
                <div className="actions">
                  <button
                    onClick={() =>
                      download(
                        "opticsdrill-original-storage.json",
                        localStorage.getItem(STORAGE) || "",
                      )
                    }
                  >
                    导出原存储内容
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "请先导出原始数据。确认清除损坏存储并重新加载？",
                        )
                      ) {
                        localStorage.removeItem(STORAGE);
                        location.reload();
                      }
                    }}
                  >
                    清除损坏数据并刷新
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        <footer>OpticsDrill · 光学训练</footer>
      </main>
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="题目详情"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDetail(null)}>
              关闭 ×
            </button>
            <small>{detail.id}</small>
            <Prompt q={detail} />
            <details className="explanation">
              <summary>查看参考答案</summary>
              <Reference q={detail} profile={s.settings.profile} />
            </details>
            <button
              className="primary"
              onClick={() =>
                launch(
                  { ...defaults, profile: s.settings.profile, length: 1 },
                  detail.id,
                )
              }
            >
              练习这一题
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <Store>
    <App />
  </Store>,
);
