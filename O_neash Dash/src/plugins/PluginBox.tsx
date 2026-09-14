import { motion, AnimatePresence } from "framer-motion";
import HomePage from "../home/HomePage";
import usePluginStore from "../store/usePluginStore";
import { Component, Suspense, type ReactNode, type ErrorInfo } from "react";
import { usePersonalSettingsStore } from '../store/usePersonalSettingsStore';
import { pluginEnabled } from '../lib/personalFeaturePolicy';

class PluginErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Plugin could not open', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="h-full flex flex-col items-center justify-center gap-4">
          <p>This app could not open. You can return home.</p>
          <button onClick={() => usePluginStore.getState().setActivePlugin(null)}>Return home</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PluginBox() {
  const plugins = usePluginStore((state) => state.plugins);
  const activePlugin = usePluginStore((state) => state.activePlugin);
  const allowed = usePersonalSettingsStore(state => pluginEnabled(activePlugin, state.settings.disabledPluginIds, state.loaded && !state.error));
  // A settings change must unmount the old app immediately, without an exit-animation grace period.
  if (!allowed) return <HomePage />;
  const selectedPlugin = plugins.find((p) => p.id === activePlugin);
  const ComponentToRender = selectedPlugin?.component ?? HomePage;

  return (
    <div className="plugin-box relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activePlugin || "home"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="h-full w-full"
        >
          <PluginErrorBoundary>
            <Suspense fallback={<div role="status" className="h-full flex items-center justify-center">Opening {selectedPlugin?.name ?? 'home'}...</div>}>
              <ComponentToRender />
            </Suspense>
          </PluginErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PluginBox;
