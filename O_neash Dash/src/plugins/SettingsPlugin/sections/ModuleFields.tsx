import { plugins } from '../../registry';
import type { PersonalFieldProps } from './ProfileFields';

const FEEDS = [{ id: 'news', label: 'News' }, { id: 'research', label: 'Research' }, { id: 'weather', label: 'Weather' }, { id: 'quotes', label: 'Quotes' }] as const;

export function ModuleFields({ value, onChange }: PersonalFieldProps) {
  return (
    <>
      <fieldset className="personal-section">
        <legend>Show modules</legend>
        <p className="personal-hint">Hidden modules retain their data. Controls for an active work session stay usable. Settings is always available.</p>
        <div className="personal-checks">
          {plugins.map(plugin => <label key={plugin.id} className="personal-check">
            <input type="checkbox" checked={plugin.id === 'settings' || !value.disabledPluginIds.includes(plugin.id)} disabled={plugin.id === 'settings'} onChange={event => onChange({
              disabledPluginIds: event.target.checked ? value.disabledPluginIds.filter(id => id !== plugin.id) : [...value.disabledPluginIds, plugin.id],
            })} />
            <span>{plugin.name}{plugin.id === 'settings' ? ' (always on)' : ''}</span>
          </label>)}
        </div>
      </fieldset>
      <div className="personal-grid">
        <fieldset className="personal-section">
          <legend>Feeds & home content</legend>
          <div className="personal-checks">
            {FEEDS.map(feed => <label key={feed.id} className="personal-check">
              <input type="checkbox" checked={value.feeds[feed.id]} onChange={event => onChange({ feeds: { ...value.feeds, [feed.id]: event.target.checked } })} />
              <span>{feed.label}</span>
            </label>)}
          </div>
        </fieldset>
        <fieldset className="personal-section">
          <legend>Analytics data sources</legend>
          <p className="personal-hint">Choose which data the Analytics panels may read.</p>
          <div className="personal-checks">
            {(['planner', 'sleep'] as const).map(source => <label key={source} className="personal-check">
              <input type="checkbox" checked={value.analytics[source]} onChange={event => onChange({ analytics: { ...value.analytics, [source]: event.target.checked } })} />
              <span>{source === 'planner' ? 'Planner' : 'Sleep'}</span>
            </label>)}
          </div>
        </fieldset>
      </div>
    </>
  );
}
