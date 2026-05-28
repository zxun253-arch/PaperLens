import { useEffect, useState } from "react";
import "./App.css";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { initDatabase } from "./lib/db/database";
import { LibraryPage } from "./pages/LibraryPage";
import { PaperDetailPage } from "./pages/PaperDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase().catch((error) => {
      console.error("Failed to initialize database", error);
      setDatabaseError(
        error instanceof Error ? error.message : "数据库初始化失败",
      );
    });
  }, []);

  return (
    <HashRouter>
      {databaseError ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          数据库初始化失败：{databaseError}
        </div>
      ) : null}
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/papers/:paperId" element={<PaperDetailPage />} />
          <Route
            path="/paper/:paperId"
            element={<Navigate to="/library" replace />}
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
