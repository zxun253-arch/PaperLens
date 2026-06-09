import { useEffect, useRef } from "react";

export type KeyboardShortcut = "ctrl+k" | "ctrl+n" | "ctrl+e" | "escape";

type ShortcutCallbacks = Partial<Record<KeyboardShortcut, () => void>>;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function getShortcut(event: KeyboardEvent): KeyboardShortcut | null {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "k") return "ctrl+k";
  if ((event.ctrlKey || event.metaKey) && key === "n") return "ctrl+n";
  if ((event.ctrlKey || event.metaKey) && key === "e") return "ctrl+e";
  if (key === "escape") return "escape";
  return null;
}

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const shortcut = getShortcut(event);
      if (!shortcut) return;
      const callback = callbacksRef.current[shortcut];
      if (!callback) return;
      event.preventDefault();
      callback();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
