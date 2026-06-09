import { useEffect, useRef, useState } from "react";

type SaveFn<T> = (value: T) => Promise<void> | void;

function isEmptyValue<T>(value: T) {
  return typeof value === "string" && value.trim().length === 0;
}

export function useAutoSave<T>(
  value: T,
  saveFn: SaveFn<T>,
  delayMs = 2000,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const lastSavedValueRef = useRef(value);
  const latestValueRef = useRef(value);
  const saveFnRef = useRef(saveFn);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  useEffect(() => {
    const runSave = async (nextValue: T) => {
      if (Object.is(nextValue, lastSavedValueRef.current)) return;
      if (isEmptyValue(nextValue)) return;
      setIsSaving(true);
      setError(null);
      try {
        await saveFnRef.current(nextValue);
        lastSavedValueRef.current = nextValue;
        setLastSaved(new Date());
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError : new Error("Auto-save failed."));
      } finally {
        setIsSaving(false);
      }
    };

    const timer = window.setTimeout(() => {
      void runSave(value);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  useEffect(() => {
    return () => {
      const nextValue = latestValueRef.current;
      if (
        !Object.is(nextValue, lastSavedValueRef.current) &&
        !isEmptyValue(nextValue)
      ) {
        void saveFnRef.current(nextValue);
      }
    };
  }, []);

  return { isSaving, lastSaved, error };
}
