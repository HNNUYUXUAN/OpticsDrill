import { day, key, stats, type State } from "./core";
export function streak(s: State, now = new Date()) {
  const days = new Set(s.attempts.map((a) => a.day));
  const d = new Date(now);
  if (!days.has(day(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(day(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function StatsDetails({ state: s }: { state: State }) {
  const t = stats(s);
  const attempts = s.attempts.filter(
    (a) =>
      a.mode !== "syntax" &&
      s.bank.questions.some((q) => key(q, s.settings.profile) === a.key),
  );
  const missed = s.bank.questions
    .map((q) => ({ q, p: s.progress[key(q, s.settings.profile)] }))
    .filter((x) => x.p?.wrong)
    .sort((a, b) => b.p.wrong - a.p.wrong)
    .slice(0, 5);
  return (
    <section className="panel">
      <h2>训练分布</h2>
      <p>
        连续练习 {streak(s)} 天 · 未练习 {t.total - t.seen} 题 · 学习中{" "}
        {t.seen - t.mastered} 题 · 已掌握 {t.mastered} 题
      </p>
      <p>
        掌握了 {attempts.filter((a) => a.result === "correct").length} 次 ·
        不确定 {attempts.filter((a) => a.result === "uncertain").length} 次 ·
        答错了 {attempts.filter((a) => a.result === "wrong").length} 次
      </p>
      <h3>高频错题</h3>
      {!missed.length ? (
        <p>暂无错误记录。</p>
      ) : (
        missed.map(({ q, p }) => (
          <div className="stat-row" key={q.id}>
            <span>
              {q.id} · {q.title}
            </span>
            <span>{p.wrong} 次错误</span>
          </div>
        ))
      )}
    </section>
  );
}
