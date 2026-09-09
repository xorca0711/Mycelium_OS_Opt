import "./App.css";
import PluginBox from "./plugins/PluginBox";
import AlwaysOnTop from "./always-visible/AOT-elements";
import { Toaster } from "./components/ui/sonner";
import { FloatingEditor } from "./components/FloatingEditor";
import React, { useEffect, useState } from "react";
import { setupDb } from "./lib/db";
import { initFontSettings } from "./lib/fontSettings";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "./components/ui/sonner";
import { useNotesStore } from "./plugins/NotesPlugin/store/useNotesStore";
import { createCloseGuard } from "./plugins/NotesPlugin/lib/closeGuard";

initFontSettings();

function AppContent() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    const reportError = (error: unknown) => toast.error("Your notes could not be saved. The window remains open.", {
      description: String(error), duration: Infinity,
      action: { label: "Retry save", onClick: () => { void useNotesStore.getState().flushAllDocuments().catch(reportError); } },
    });
    const guard = createCloseGuard({
      hasPending: () => Object.values(useNotesStore.getState().saveStates).some(state => state.status !== "saved"),
      flush: () => useNotesStore.getState().flushAllDocuments(),
      destroy: () => appWindow.destroy(),
      onError: reportError,
      isDisposed: () => disposed,
    });
    void appWindow.onCloseRequested(guard).then(stop => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(error => { if (!disposed) toast.error("Could not enable save-before-close.", { description: String(error) }); });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  return (
    <main className="main-container relative" data-tauri-drag-region>
      <AlwaysOnTop />
      <PluginBox />
      <Toaster />
      <FloatingEditor />
    </main>
  );
}

function App() {
  const [dbReady, setDbReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbReady && !error) return;
    document.getElementById("splash-screen")?.remove();
    document.getElementById("root")?.classList.add("app-enter");
  }, [dbReady, error]);

  useEffect(() => {
    // This calls the setupDb function you created
    const initApp = async () => {
      try {
        await setupDb();
        setDbReady(true);
        console.log("Database and Directory Handshake Complete.");
      } catch (err) {
        console.error("Initialization failed:", err);
        setError("Could not initialize the database.");
      }
    };
    initApp();
  }, []);

  // Show a clean loading state while the database initializes
  if (error) return <div className="error-screen">{error}</div>;
  if (!dbReady)
    return <div className="loading-screen">Preparing o_neash...</div>;

  return <AppContent />;
}

export default App;
