import { useEffect, useRef, useState } from "react";

/**
 * Debounced autosave: call it with the current value and a save function;
 * edits save themselves ~800ms after the typing stops, and the returned
 * status drives a "Saved · just now" chip. Editors should never make
 * someone remember to press a save button.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 800) {
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);
  latest.current = value;
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveRef.current(latest.current);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delayMs);
    return () => clearTimeout(timer.current);
  }, [value, delayMs]);

  return status;
}

export function AutosaveChipText(status: ReturnType<typeof useAutosave>): string {
  switch (status) {
    case "dirty":
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Couldn't save — will retry as you type";
    default:
      return "";
  }
}
