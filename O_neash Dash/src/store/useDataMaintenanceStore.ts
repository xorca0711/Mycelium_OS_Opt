import { create } from 'zustand';
import { useNotesStore } from '../plugins/NotesPlugin/store/useNotesStore';

interface MaintenanceState { busy: boolean; label: string; restartRequired: boolean }
export const useDataMaintenanceStore = create<MaintenanceState>(() => ({ busy: false, label: '', restartRequired: false }));

/** Flush note drafts before a workspace operation and prevent overlapping operations. */
export async function runDataMaintenance<T>(label: string, operation: () => Promise<T>, options: { restartOnSuccess?: boolean } = {}): Promise<T> {
  const state = useDataMaintenanceStore.getState();
  if (state.busy || state.restartRequired) throw new Error('Finish the current data operation or restart Mycelium first.');
  useDataMaintenanceStore.setState({ busy: true, label });
  try {
    await useNotesStore.getState().flushAllDocuments();
    const result = await operation();
    if (options.restartOnSuccess) useDataMaintenanceStore.setState({ restartRequired: true });
    return result;
  } finally {
    useDataMaintenanceStore.setState({ busy: false, label: '' });
  }
}
