import { create } from 'zustand';
import { plugins } from '../plugins/registry';
import { getDefaultPersonalSettings, validatePersonalSettings, type PersonalSettings } from '../lib/personalSettings';
import { loadPersonalSettings, savePersonalSettings } from '../lib/personalSettingsDb';

export interface PersonalSettingsStore {
  settings: PersonalSettings;
  loaded: boolean;
  /** Load failure affecting global readiness; save failures reject to the caller. */
  error: string | null;
  load: () => Promise<void>;
  save: (settings: PersonalSettings) => Promise<void>;
}

let pending: Promise<unknown> = Promise.resolve();
function serialize(operation: () => Promise<void>): Promise<void> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const usePersonalSettingsStore = create<PersonalSettingsStore>((set) => ({
  settings: getDefaultPersonalSettings(), loaded: false, error: null,
  load: () => serialize(async () => {
    try { set({ settings: await loadPersonalSettings(), loaded: true, error: null }); }
    catch (error) { set({ loaded: true, error: errorMessage(error) }); }
  }),
  save: async (value) => {
    const settings = validatePersonalSettings(value, plugins.map(plugin => plugin.id));
    return serialize(async () => {
      set({ settings: await savePersonalSettings(settings), loaded: true, error: null });
    });
  },
}));
