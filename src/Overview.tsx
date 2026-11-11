import { stats, type State, type Config } from "./core";
import { streak } from "./StatsDetails";
const descriptions: Record<string, string> = {
  "1": "双缝、薄膜、迈克耳孙与牛顿环。",
  "2": "半波带、单缝与光栅。",
  "3": "平板、棱镜、球面与透镜成像。",
  "4": "调焦、放大本领、照度与分辨。",
  "5": "偏振片、波片与消光光谱。",
  "6": "指数吸收、瑞利散射与柯西公式。",
  "7": "热辐射、光电效应与康普顿散射。",
  "8": "玻尔能级与激光相干长度。",
};
export function Overview({
  state,
  onStart,
  onResume,
  onBrowse,
}: {
  state: State;
  onStart: (config?: Partial<Config>) => void;
  onResume: () => void;
  onBrowse: () => void;
}) {
  const t = stats(state),
    resume = state.session && !state.session.finished;
  return (
    <>
      <div className="page-heading">
        <h1>光学课程训练</h1>
        <p>从干涉、衍射到量子光学，逐题练习课程指定的52道题。</p>
        <div className="heading-meta">
          {state.bank.categories.length} 个模块 <span>/</span> {t.total} 道题
        </div>
      </div>
      <div className="start-actions">
        <button
          className="primary"
          onClick={() => (resume ? onResume() : onStart())}
        >
          {resume ? "继续练习" : "开始速刷"}
        </button>
        <button onClick={() => onStart({ mode: "paper" })}>纸笔默写</button>
      </div>
      <div className="metrics">
        {[
          ["已练习", t.seen],
          ["今日练习", t.today],
          [
            "正确率",
            t.attempts ? Math.round((t.correct / t.attempts) * 100) + "%" : "—",
          ],
          ["已掌握", t.mastered],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>按模块巩固</h2>
        <button className="text-button" onClick={onBrowse}>
          浏览全部题目
        </button>
      </div>
      <div className="directory">
        {state.bank.categories.map((c) => {
          const summary = stats(state, c.id);
          return (
            <details className="directory-group" key={c.id}>
              <summary>
                <span className="group-title">
                  <span>{c.name}</span>
                  <small>{descriptions[c.id] || c.name}</small>
                </span>
                <span className="group-count">{summary.total} 题</span>
              </summary>
              <div className="group-body">
                <p>
                  已练习 {summary.seen} 题 · 已掌握 {summary.mastered} 题 ·
                  待复习 {summary.due} 题
                </p>
                <div className="actions">
                  <button
                    className="primary"
                    onClick={() =>
                      onStart({ category: c.id, tag: "", filter: "all" })
                    }
                  >
                    练习本模块
                  </button>
                  <button
                    onClick={() =>
                      onStart({
                        category: c.id,
                        tag: "",
                        filter: "all",
                        mode: "paper",
                      })
                    }
                  >
                    本模块默写
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <div className="study-summary">
        <span>连续练习 {streak(state)} 天</span>
        <button
          className="text-button"
          onClick={() => onStart({ filter: "wrong", category: "", tag: "" })}
        >
          错题 {t.wrong} 道
        </button>
        <button
          className="text-button"
          onClick={() => onStart({ filter: "due", category: "", tag: "" })}
        >
          待复习 {t.due} 道
        </button>
      </div>
    </>
  );
}
