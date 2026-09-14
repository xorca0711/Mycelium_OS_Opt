import { useState, useEffect } from 'react';
import './ClockPlugin.css';
import { usePersonalSettingsStore } from '../../store/usePersonalSettingsStore';
import { formatHomeClock } from '../../lib/personalFeaturePolicy';

/**
 * Clock Plugin Component
 * Displays current time and date with second animation
 */
function ClockPlugin() {
  const [time, setTime] = useState<Date>(new Date());
  const biosStyle = true; // Toggle between original and BIOS style
  const timeZone = usePersonalSettingsStore(s => s.settings.timeZone);
  const locale = usePersonalSettingsStore(s => s.settings.locale);
  const formatted = formatHomeClock(time, timeZone, locale);

  useEffect(() => {
    const timer: ReturnType<typeof setInterval> = setInterval(
      () => setTime(new Date()),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`plugin-clock ${biosStyle ? 'bios-style' : ''}`}>
      {biosStyle && <div className="clock-label">{formatted.zone}</div>}
      <div className="clock-indicator"></div>
      <div className="clock-time">
        {formatted.time}
      </div>
      <div className="clock-date">
        {formatted.date}
      </div>
    </div>
  );
}

export default ClockPlugin;
