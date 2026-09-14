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
import { usePersonalSettingsStore } from "./store/usePersonalSettingsStore";
import usePluginStore from "./store/usePluginStore";
import { useDataMaintenanceStore } from './store/useDataMaintenanceStore';
import { getRestoreStatus, applyRestoredPreferences, acknowledgeRestore } from './lib/dataManagement';

initFontSettings();

function AppContent() {
  const maintenance = useDataMaintenanceStore();
  useEffect(() => {
    const blockShortcuts = (event: KeyboardEvent) => {
      const state = useDataMaintenanceStore.getState();
      if (!state.busy && !state.restartRequired) return;
      if (state.busy) event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', blockShortcuts, true);
    return () => window.removeEventListener('keydown', blockShortcuts, true);
  }, []);
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
    void appWindow.onCloseRequested(event => {
      if (useDataMaintenanceStore.getState().busy) { event.preventDefault(); return; }
      return guard(event);
    }).then(stop => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(error => { if (!disposed) toast.error("Could not enable save-before-close.", { description: String(error) }); });
    return () => { disposed = true; unlisten?.(); };
  }, []);

  return (
    <><main className="main-container relative" data-tauri-drag-region inert={maintenance.busy || maintenance.restartRequired}>
      <AlwaysOnTop />
      <PluginBox />
      <Toaster />
      <FloatingEditor />
    </main>
    {(maintenance.busy || maintenance.restartRequired) && <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-6" role="dialog" aria-modal="true" aria-label="Data maintenance">
      <div className="max-w-md rounded-lg border border-white/20 bg-zinc-950 p-6 text-white" aria-live="polite">
        <h2 className="text-lg font-semibold">{maintenance.restartRequired ? 'Restart to apply your backup' : maintenance.label}</h2>
        <p className="mt-3 text-sm text-zinc-300">{maintenance.restartRequired ? 'Close Mycelium and reopen it. Your current workspace will be preserved in a rollback folder while the selected backup is restored.' : 'Saving pending notes and completing the data operation. Please keep this window open.'}</p>
        {maintenance.restartRequired && <button className="mt-4 rounded border px-4 py-2" onClick={() => { void getCurrentWindow().destroy(); }}>Close Mycelium</button>}
      </div>
    </div>}</>
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
        if (isTauri()) {
          const restore = await getRestoreStatus();
          if (restore.appliedPreferences) {
            applyRestoredPreferences(restore.appliedPreferences);
            await acknowledgeRestore();
            window.location.reload();
            return;
          }
          if (restore.pending) useDataMaintenanceStore.setState({ restartRequired: true });
        }
        try {
          await usePersonalSettingsStore.getState().load();
          if (usePersonalSettingsStore.getState().error) usePluginStore.getState().setActivePlugin('settings');
        } catch (settingsError) {
          console.error('Personal settings could not load:', settingsError);
          usePluginStore.getState().setActivePlugin('settings');
        }
        setDbReady(true);
        console.log("Database and Directory Handshake Complete.");
      } catch (err) {
        console.error("Initialization failed:", err);
        setError(`Could not initialize the database: ${String(err)}`);
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
