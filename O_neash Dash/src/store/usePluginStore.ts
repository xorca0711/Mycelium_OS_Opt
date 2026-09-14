import { create } from 'zustand';
import { plugins } from '../plugins/registry';
import type { PluginItem } from '@/types';
import { usePersonalSettingsStore } from './usePersonalSettingsStore';
import { pluginEnabled } from '../lib/personalFeaturePolicy';

interface PluginStore {
  plugins: PluginItem[];
  activePlugin: string | null;
  setActivePlugin: (id: string | null) => void;
}

const usePluginStore = create<PluginStore>((set) => ({
  // State
  plugins: plugins,
  activePlugin: null,

  // Action (The "Remote Control")
  setActivePlugin: (id) => {
    const { settings, loaded, error } = usePersonalSettingsStore.getState();
    if (pluginEnabled(id, settings.disabledPluginIds, loaded && !error)) set({ activePlugin: id });
  },
}));

export default usePluginStore;
