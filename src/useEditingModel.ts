import { useEffect, useRef, useState } from "react";
import { editingModels, type EditingModel } from "./types";
import { loadEditingModel, cancelEditing, isEditingModelCached } from "./writing";
export function useEditingModel() {
  const [ready, setReady] = useState<EditingModel | null>(null),
    [loading, setLoading] = useState<EditingModel | null>(null),
    [progress, setProgress] = useState(0),
    [detail, setDetail] = useState(""),
    [error, setError] = useState(""),
    [cached, setCached] = useState<EditingModel[]>([]);
  const generation = useRef(0);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
      cancelEditing();
    };
  }, []);
  async function refresh() {
    try {
      const entries=await Promise.all((Object.keys(editingModels) as EditingModel[]).map(async model=>await isEditingModelCached(model)?model:null));
      setCached(entries.filter((model):model is EditingModel=>model!==null));
    } catch {}
  }
  async function prepare(model: EditingModel) {
    if (loading) return false;
    const token = ++generation.current;
    setLoading(model);
    setReady(null);
    setProgress(0);
    setError("");
    setDetail("Connecting to the model library…");
    try {
      await loadEditingModel(model, (p) => {
        if (token !== generation.current) return;
        if (p.status === "progress" && p.file && p.total) {
          setProgress(Math.min(99, Math.round((p.loaded || 0) / p.total * 100)));
          setDetail(`${((p.loaded || 0) / 1e6).toFixed(1)} MB of ${(p.total / 1e6).toFixed(1)} MB`);
        } else if (p.status === "done")
          setDetail("Preparing the editing model…");
      });
      if (token !== generation.current) return false;
      setReady(model);
      setProgress(100);
      setDetail("Downloaded and ready");
      setCached((old) => [...new Set([...old, model])]);
      return true;
    } catch (e) {
      if (token === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not download the model. Check your connection and storage.",
        );
      return false;
    } finally {
      if (token === generation.current) setLoading(null);
    }
  }
  function cancel() {
    generation.current++;
    cancelEditing();
    setLoading(null);
    setReady(null);
    setError("");
    setDetail("Cancelled. Downloaded files can be reused when you retry.");
  }
  async function remove(model: EditingModel) {
    if (loading) return;
    if (!window.MurmurAndroid?.removeNativeSpeech?.(model)) { setError("Finish the active dictation before removing its model."); return; }
    if (ready === model) { cancelEditing(); setReady(null); }
    await refresh();
  }

  return {
    ready,
    loading,
    progress,
    detail,
    error,
    cached,
    prepare,
    cancel,
    remove,
    refresh,
  };
}
export type EditingDownload = ReturnType<typeof useEditingModel>;
