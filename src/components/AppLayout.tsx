import { Outlet, useNavigate } from "react-router-dom";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const navigate = useNavigate();
  useKeyboardShortcuts({
    "ctrl+k": () => {
      const searchInput = document.querySelector<HTMLInputElement>(
        "[data-library-search]",
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      } else {
        navigate("/library");
      }
    },
    escape: () => {
      // Only navigate back if we're not on the main library page
      const path = window.location.hash.replace("#", "") || "/";
      if (path !== "/" && path !== "/library") {
        navigate("/library");
      }
    },
  });

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 pb-8 pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
