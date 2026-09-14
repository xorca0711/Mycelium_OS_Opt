import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePersonalSettingsStore } from '@/store/usePersonalSettingsStore';
import { validatePersonalSettings, type PersonalSettings as Settings } from '@/lib/personalSettings';
import { plugins } from '../../registry';
import { ProfileFields } from './ProfileFields';
import { CapacityFields } from './CapacityFields';
import { ModuleFields } from './ModuleFields';
import { PersonalData } from './PersonalData';

export function PersonalSettings() {
  const { settings, loaded, error: storeError, load, save } = usePersonalSettingsStore();
  const [draft, setDraft] = useState(settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const loadFailed = loaded && !!storeError;

  useEffect(() => { if (!loaded) void load().catch(() => {}); }, [loaded, load]);
  useEffect(() => { if (!dirty) setDraft(settings); }, [settings, dirty]);

  const update = useCallback((patch: Partial<Settings>) => {
    setDraft(previous => ({ ...previous, ...patch }));
    setDirty(true);
    setError(null);
    setMessage(null);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current || avatarBusy || !loaded || loadFailed) return;
    setError(null);
    setMessage(null);
    let checked: Settings;
    try { checked = validatePersonalSettings(draft, plugins.map(plugin => plugin.id)); }
    catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      statusRef.current?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await save(checked);
      setDraft(checked);
      setDirty(false);
      setMessage('Personal settings saved.');
    } catch (error) { setError(`Could not save your changes. ${error instanceof Error ? error.message : String(error)} Try saving again.`); }
    finally { busy.current = false; setSaving(false); }
  }

  return (
    <div className="personal-settings">
      <style>{`
        .personal-settings { color: #e6e6e6; font-size: 1.12rem; max-width: 1100px; margin: 0 auto; padding-bottom: 24px; }
        .personal-settings .personal-section { border: 1px solid #303030; border-radius: 8px; padding: 18px; margin: 0 0 22px; min-width: 0; }
        .personal-settings legend, .personal-settings h3 { font-size: 1.35rem; color: #00c4a7; padding: 0 6px; margin: 0 0 12px; }
        .personal-settings h3 { padding: 0; }
        .personal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 18px; }
        .personal-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 12px; }
        .personal-settings label { display: grid; align-content: start; gap: 7px; min-width: 0; }
        .personal-settings input:not([type=checkbox]), .personal-settings select { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid #555; border-radius: 5px; padding: 8px 10px; background: #101010; color: #fff; color-scheme: dark; font: inherit; }
        .personal-settings input[type=file] { width: min(100%, 280px); font-size: 1rem; }
        .personal-settings button { border: 1px solid #555; border-radius: 5px; color: #f2f2f2; background: #151515; padding: 8px 12px; font: inherit; cursor: pointer; }
        .personal-settings button:disabled { opacity: .5; cursor: not-allowed; }
        .personal-settings :focus-visible { outline: 2px solid #00c4a7; outline-offset: 3px; }
        .personal-settings .personal-hint { color: #aaa; font-size: 1rem; line-height: 1.45; margin: 5px 0 12px; }
        .personal-settings .personal-error { color: #ff9999; }
        .personal-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
        .personal-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px; }
        .personal-settings label.personal-check { display: flex; align-items: center; gap: 9px; line-height: 1.3; }
        .personal-settings input[type=checkbox] { width: 18px; height: 18px; flex-shrink: 0; accent-color: #00c4a7; }
        .personal-settings dl { margin: 0; }
        .personal-settings dd { margin: 6px 0 18px; }
        .personal-settings code { font-size: .86rem; overflow-wrap: anywhere; }
        .personal-save-bar { position: sticky; bottom: 0; z-index: 2; background: #080808; border: 1px solid #333; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
      `}</style>
      <h2 style={{ fontSize: '1.7rem', marginTop: 0 }}>Personal settings</h2>
      <p className="personal-hint">Set your profile, planning capacity, and the parts of Mycelium you use.</p>
      {!loaded && <p role="status">Loading personal settings…</p>}
      {loadFailed && <p role="alert" className="personal-error">Stored settings could not be loaded. {storeError} <button type="button" onClick={() => { void load().catch(() => {}); }}>Retry loading settings</button></p>}
      <form onSubmit={event => { void submit(event); }}>
        <fieldset disabled={!loaded || loadFailed || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-label="Personal preferences">
          <ProfileFields value={draft} onChange={update} onBusyChange={setAvatarBusy} />
          <CapacityFields value={draft} onChange={update} />
          <ModuleFields value={draft} onChange={update} />
        </fieldset>
        <div className="personal-save-bar personal-inline">
          <button type="submit" disabled={!loaded || loadFailed || saving || avatarBusy || !dirty} style={{ borderColor: '#00c4a7', color: '#00c4a7' }}>
            {saving ? 'Saving…' : avatarBusy ? 'Preparing avatar…' : 'Save personal settings'}
          </button>
          <button type="button" disabled={!dirty || saving || avatarBusy} onClick={() => { setDraft(settings); setDirty(false); setError(null); setMessage(null); }}>Discard changes</button>
          <div ref={statusRef} tabIndex={-1} role={error ? 'alert' : 'status'} className={error ? 'personal-error' : 'personal-hint'} style={{ margin: 0 }}>
            {error ?? message ?? (dirty ? 'You have unsaved changes.' : 'Changes apply after saving.')}
          </div>
        </div>
      </form>
      {loaded && !storeError && <PersonalData disabledPluginIds={settings.disabledPluginIds} draftPending={dirty || saving || avatarBusy} weatherEnabled={settings.feeds.weather} />}
    </div>
  );
}
