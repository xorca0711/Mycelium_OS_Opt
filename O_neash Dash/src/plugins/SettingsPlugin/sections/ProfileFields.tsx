import { useEffect, useMemo, useRef, useState } from 'react';
import type { PersonalSettings } from '@/lib/personalSettings';
import { prepareAvatar } from './avatarImage';

export interface PersonalFieldProps {
  value: PersonalSettings;
  onChange: (patch: Partial<PersonalSettings>) => void;
}

function availableTimeZones(current: string): string[] {
  const supported = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  const zones = supported.supportedValuesOf?.('timeZone') ?? ['UTC', 'Asia/Seoul', 'America/New_York', 'Europe/London'];
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [...new Set([...zones, local, ...(current === 'system' ? [] : [current])])].sort();
}

export function ProfileFields({ value, onChange, onBusyChange }: PersonalFieldProps & { onBusyChange: (busy: boolean) => void }) {
  const [imageError, setImageError] = useState<string | null>(null);
  const generation = useRef(0);
  const timeZones = useMemo(() => availableTimeZones(value.timeZone), [value.timeZone]);
  useEffect(() => () => { generation.current++; }, []);

  async function upload(file: File): Promise<void> {
    const current = ++generation.current;
    setImageError(null);
    onBusyChange(true);
    try {
      const avatarDataUrl = await prepareAvatar(file);
      if (current === generation.current) onChange({ avatarDataUrl });
    } catch (error) {
      if (current === generation.current) setImageError(String(error instanceof Error ? error.message : error));
    } finally { if (current === generation.current) onBusyChange(false); }
  }

  return (
    <fieldset className="personal-section">
      <legend>Profile & regional format</legend>
      <div className="personal-grid">
        <label htmlFor="personal-display-name">Display name <span className="personal-hint">(optional)</span>
          <input id="personal-display-name" autoComplete="nickname" maxLength={80} placeholder="Your name" aria-describedby="personal-display-name-help" value={value.displayName} onChange={event => onChange({ displayName: event.target.value })} />
          <span id="personal-display-name-help" className="personal-hint">Shown in the Home welcome. Leave blank to use the default greeting.</span>
        </label>
        <div>
          <label htmlFor="personal-avatar">Avatar <span className="personal-hint">(optional)</span></label>
          <div className="personal-inline" style={{ marginTop: 8 }}>
            {value.avatarDataUrl && <img src={value.avatarDataUrl} width={64} height={64} alt="Avatar preview" style={{ objectFit: 'contain', borderRadius: 8 }} />}
            <input id="personal-avatar" type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-describedby="personal-avatar-help" onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }} />
            {value.avatarDataUrl && <button type="button" onClick={() => { generation.current++; onBusyChange(false); setImageError(null); onChange({ avatarDataUrl: null }); }}>Remove avatar</button>}
          </div>
          <p id="personal-avatar-help" className="personal-hint">PNG, JPEG, GIF, or WebP, up to 10 MB. Saved locally as a still image, up to 256 px and 512 KB.</p>
          {imageError && <p role="alert" className="personal-error">{imageError}</p>}
        </div>
        <label htmlFor="personal-timezone">Home clock timezone
          <select id="personal-timezone" value={value.timeZone} onChange={event => onChange({ timeZone: event.target.value })} aria-describedby="personal-timezone-help">
            <option value="system">System ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
            {timeZones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
          <span id="personal-timezone-help" className="personal-hint">Task and log dates continue to use the device's local timezone.</span>
        </label>
        <label htmlFor="personal-locale">Date & number format
          <select id="personal-locale" value={value.locale} onChange={event => onChange({ locale: event.target.value as PersonalSettings['locale'] })} aria-describedby="personal-locale-help">
            <option value="system">System format</option><option value="en-US">English (United States)</option><option value="ko-KR">Korean (South Korea)</option>
          </select>
          <span id="personal-locale-help" className="personal-hint">Controls supported date and number displays; it does not translate the interface.</span>
        </label>
        <label htmlFor="personal-week-start">Planner calendar week starts on
          <select id="personal-week-start" value={value.weekStartsOn} onChange={event => onChange({ weekStartsOn: event.target.value === '1' ? 1 : 0 })}>
            <option value={1}>Monday</option><option value={0}>Sunday</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
