import type { PersonalSettings } from '../../../lib/personalSettings';
import { dailyCapacity, isPreferredFocusTime } from '../lib/planningPreferences';
import usePluginStore from '../../../store/usePluginStore';

interface Props { settings: PersonalSettings; now: Date; remaining: number; }

export function PlanningPreferencesSummary({ settings, now, remaining }: Props) {
  const capacity = dailyCapacity(settings, now);
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 16px', fontSize: '0.9rem', color: 'rgba(255,255,255,.65)' }}>
    <span>{capacity === 0 ? 'Rest day · no extra task suggestions' : `${remaining} / ${capacity} min available for suggested work`}</span>
    <span>{settings.focusMinutes}m focus / {settings.breakMinutes}m break</span>
    <span style={{ color: isPreferredFocusTime(settings, now) ? '#00c4a7' : undefined }}>
      Preferred focus {settings.focusStart}–{settings.focusEnd}
    </span>
    <button onClick={() => usePluginStore.getState().setActivePlugin('settings')}
      style={{ border: '1px solid rgba(255,255,255,.25)', background: 'none', color: '#00c4a7', padding: '3px 8px', cursor: 'pointer' }}>
      Edit preferences
    </button>
  </div>;
}
