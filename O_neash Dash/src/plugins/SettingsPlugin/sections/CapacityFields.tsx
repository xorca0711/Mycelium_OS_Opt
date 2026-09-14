import type { PersonalFieldProps } from './ProfileFields';
import type { PersonalSettings } from '@/lib/personalSettings';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const numberValue = (value: number) => Number.isFinite(value) ? value : '';

export function CapacityFields({ value, onChange }: PersonalFieldProps) {
  const order = value.weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const total = value.dailyMinutes.reduce((sum, minutes) => sum + (Number.isFinite(minutes) ? minutes : 0), 0);
  return (
    <fieldset className="personal-section">
      <legend>Weekly capacity & focus</legend>
      <p className="personal-hint" id="personal-capacity-help">Available minutes for planned work each day, from 0 to 1,440. Set 0 for a rest day.</p>
      <div className="personal-days">
        {order.map(day => <label key={day} htmlFor={`personal-day-${day}`}>{DAYS[day]}
          <input id={`personal-day-${day}`} type="number" min={0} max={1440} step={1} required value={numberValue(value.dailyMinutes[day])} aria-describedby="personal-capacity-help" onChange={event => {
            const dailyMinutes: PersonalSettings['dailyMinutes'] = [...value.dailyMinutes];
            dailyMinutes[day] = event.target.valueAsNumber;
            onChange({ dailyMinutes });
          }} />
          <span className="personal-hint">{value.dailyMinutes[day] === 0 ? 'Rest day' : 'minutes'}</span>
        </label>)}
      </div>
      <p className="personal-hint">Weekly capacity: {Math.floor(total / 60)} hours {total % 60} minutes</p>
      <div className="personal-grid">
        <label htmlFor="personal-focus-start">Preferred focus window starts
          <input id="personal-focus-start" type="time" required value={value.focusStart} onChange={event => onChange({ focusStart: event.target.value })} />
        </label>
        <label htmlFor="personal-focus-end">Preferred focus window ends
          <input id="personal-focus-end" type="time" required value={value.focusEnd} onChange={event => onChange({ focusEnd: event.target.value })} />
        </label>
        <label htmlFor="personal-focus-minutes">Focus session (minutes)
          <input id="personal-focus-minutes" type="number" required min={1} max={240} step={1} value={numberValue(value.focusMinutes)} onChange={event => onChange({ focusMinutes: event.target.valueAsNumber })} />
        </label>
        <label htmlFor="personal-break-minutes">Break (minutes)
          <input id="personal-break-minutes" type="number" required min={1} max={120} step={1} value={numberValue(value.breakMinutes)} onChange={event => onChange({ breakMinutes: event.target.valueAsNumber })} />
        </label>
      </div>
      <p className="personal-hint">Focus times use the device's local time. A window ending earlier than it starts continues into the next day.</p>
    </fieldset>
  );
}
