import { createContext, useContext, useState, type ReactNode } from "react";
import { load, STORAGE, type State } from "./core";
const Context = createContext<{
  state: State;
  update: (fn: (s: State) => State, recover?: boolean) => void;
  error: string;
}>(null!);
export function Store({ children }: { children: ReactNode }) {
  const [loaded] = useState(load);
  const [state, set] = useState(loaded.state);
  const [error, setError] = useState(loaded.error);
  const [blocked, setBlocked] = useState(!!loaded.error);
  function update(fn: (s: State) => State, recover = false) {
    const value = fn(state);
    try {
      if (blocked && !recover && localStorage.getItem(STORAGE))
        throw Error("请先备份损坏数据，然后清除损坏数据并刷新。");
      localStorage.setItem(STORAGE, JSON.stringify(value));
      setBlocked(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请导出备份");
    }
    set(value);
  }
  return (
    <Context.Provider value={{ state, update, error }}>
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
