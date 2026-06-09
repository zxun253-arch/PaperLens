import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "./components/AppLayout";
import { ToastProvider } from "./components/Toast";
import { useTheme } from "./hooks/useTheme";
import { initDatabase } from "./lib/db/database";
import { initPluginSystem } from "./plugins/pluginSystem";

const LibraryPage = lazy(() =>
  import("./pages/LibraryPage").then((module) => ({
    default: module.LibraryPage,
  })),
);
const PaperComparePage = lazy(() =>
  import("./pages/PaperComparePage").then((module) => ({
    default: module.PaperComparePage,
  })),
);
const PaperAgentPage = lazy(() =>
  import("./pages/PaperAgentPage").then((module) => ({
    default: module.PaperAgentPage,
  })),
);
const PaperDetailPage = lazy(() =>
  import("./pages/PaperDetailPage").then((module) => ({
    default: module.PaperDetailPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

function RedirectPaper() {
  const { paperId } = useParams();
  return <Navigate to={`/papers/${paperId}`} replace />;
}

function LoadingPage() {
  return (
    <div className="flex items-center justify-center p-10">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        <svg
          aria-hidden="true"
          className="mr-2 inline-block h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        加载中...
      </p>
    </div>
  );
}

function App() {
  useTheme();
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => initPluginSystem())
      .catch((error) => {
        console.error("Failed to initialize database", error);
        setDatabaseError(
          error instanceof Error ? error.message : "数据库初始化失败",
        );
      });
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        {databaseError ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950 dark:text-red-200">
            数据库初始化失败：{databaseError}
          </div>
        ) : null}
        <ToastProvider>
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/library" replace />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/compare" element={<PaperComparePage />} />
              <Route path="/agent" element={<PaperAgentPage />} />
                <Route path="/papers/:paperId" element={<PaperDetailPage />} />
                <Route
                  path="/paper/:paperId"
                  element={<RedirectPaper />}
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
