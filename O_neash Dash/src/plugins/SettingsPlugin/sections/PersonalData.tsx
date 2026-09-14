import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getDataLocation, type DataLocation } from '@/lib/dataLocation';
import usePluginStore from '@/store/usePluginStore';
import { getActiveTarget, setTarget } from '../../SleepTrackerPlugin/lib/sleepDb';
import { clearWeatherLocation, getWeatherLocation, subscribeWeatherLocation, type WeatherLocation } from '@/home/weather/weatherLocation';

export function PersonalData({ disabledPluginIds, draftPending, weatherEnabled }: { disabledPluginIds: readonly string[]; draftPending: boolean; weatherEnabled: boolean }) {
  const [location, setLocation] = useState<DataLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRetry, setLocationRetry] = useState(0);
  const [sleepLoading, setSleepLoading] = useState(true);
  const [sleepLoadError, setSleepLoadError] = useState<string | null>(null);
  const [sleepRetry, setSleepRetry] = useState(0);
  const [bedtime, setBedtime] = useState('');
  const [duration, setDuration] = useState('');
  const [sleepMessage, setSleepMessage] = useState<string | null>(null);
  const [sleepError, setSleepError] = useState<string | null>(null);
  const [savingSleep, setSavingSleep] = useState(false);
  const sleepBusy = useRef(false);
  const navigate = usePluginStore(state => state.setActivePlugin);
  const [weatherLocation, setWeatherLocationState] = useState<WeatherLocation | null>(null);
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    try { setWeatherLocationState(getWeatherLocation()); }
    catch (error) { setWeatherError(`Could not read the saved weather location. ${String(error)}`); }
    return subscribeWeatherLocation(value => { setWeatherLocationState(value); setWeatherMessage(null); });
  }, []);

  function clearSavedCity(): void {
    setWeatherError(null);
    try {
      clearWeatherLocation();
      setWeatherMessage('Weather location cleared.');
    } catch (error) { setWeatherError(`Could not clear the saved location. Try again. ${String(error)}`); }
  }

  useEffect(() => {
    let active = true;
    setLocationError(null);
    void getDataLocation().then(value => { if (active) setLocation(value); })
      .catch(error => { if (active) setLocationError(String(error)); });
    return () => { active = false; };
  }, [locationRetry]);

  useEffect(() => {
    let active = true;
    setSleepLoading(true);
    setSleepLoadError(null);
    void getActiveTarget().then(target => {
      if (!active) return;
      setBedtime(target?.target_sleep_start ?? '');
      setDuration(target ? String(target.target_duration) : '');
    }).catch(error => { if (active) setSleepLoadError(String(error)); })
      .finally(() => { if (active) setSleepLoading(false); });
    return () => { active = false; };
  }, [sleepRetry]);

  async function saveSleep(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sleepBusy.current || sleepLoading || sleepLoadError) return;
    setSleepError(null);
    setSleepMessage(null);
    const hours = Number(duration);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bedtime) || !Number.isFinite(hours) || hours <= 0 || hours > 14) {
      setSleepError('Enter a valid bedtime and a sleep duration greater than 0 and up to 14 hours.');
      return;
    }
    sleepBusy.current = true;
    setSavingSleep(true);
    try {
      await setTarget(bedtime, hours);
      setSleepMessage('Sleep target saved. Earlier targets remain in your history.');
    } catch (error) { setSleepError(`Could not save the sleep target. ${String(error)}`); }
    finally { sleepBusy.current = false; setSavingSleep(false); }
  }

  return (
    <>
      <section className="personal-section" aria-labelledby="personal-weather-location">
        <h3 id="personal-weather-location">Weather location</h3>
        <p>{weatherLocation ? weatherLocation.name : 'No city saved.'}</p>
        <p className="personal-hint">The saved city is stored locally on this device. To choose a city, enable Weather under Feeds & home content, save, and set the city on Home.</p>
        <div className="personal-inline">
          <button type="button" disabled={!weatherLocation && !weatherError} onClick={clearSavedCity}>Clear saved weather location</button>
          <button type="button" disabled={draftPending || !weatherEnabled} onClick={() => navigate(null)}>Open Home to set city</button>
          {weatherMessage && <span role="status">{weatherMessage}</span>}
          {weatherError && <span role="alert" className="personal-error">{weatherError}</span>}
        </div>
      </section>
      <form onSubmit={event => { void saveSleep(event); }}>
        <fieldset className="personal-section" disabled={sleepLoading || savingSleep || !!sleepLoadError}>
          <legend>Sleep target</legend>
          <p className="personal-hint">Saving adds a new target to your history. Sleep entries are edited in Sleep Tracker.</p>
          {sleepLoading && <p role="status">Loading your current target…</p>}
          <div className="personal-grid">
            <label htmlFor="personal-sleep-start">Target bedtime (device local time)
              <input id="personal-sleep-start" type="time" required value={bedtime} onChange={event => { setBedtime(event.target.value); setSleepMessage(null); }} />
            </label>
            <label htmlFor="personal-sleep-duration">Target duration (hours)
              <input id="personal-sleep-duration" type="number" required min={0.01} max={14} step="any" value={duration} onChange={event => { setDuration(event.target.value); setSleepMessage(null); }} />
            </label>
          </div>
          <div className="personal-inline" style={{ marginTop: 16 }}>
            <button type="submit">{savingSleep ? 'Saving target…' : 'Save sleep target'}</button>
            {sleepMessage && <span role="status">{sleepMessage}</span>}
            {sleepError && <span role="alert" className="personal-error">{sleepError} Try saving again.</span>}
          </div>
        </fieldset>
      </form>
      {sleepLoadError && <p role="alert" className="personal-error">Could not load the sleep target. {sleepLoadError} <button type="button" onClick={() => setSleepRetry(value => value + 1)}>Retry loading target</button></p>}

      <section className="personal-section" aria-labelledby="personal-existing-data">
        <h3 id="personal-existing-data">Edit goals & personal records</h3>
        <div className="personal-inline">
          {[
            { id: 'habits', label: 'Edit habits' },
            { id: 'projects', label: 'Edit arcs & projects' },
            { id: 'academic', label: 'Edit academic subjects' },
            { id: 'sleep-tracker', label: 'Edit sleep entries' },
          ].map(module => <button type="button" key={module.id} disabled={draftPending || disabledPluginIds.includes(module.id)}
            title={disabledPluginIds.includes(module.id) ? 'Show this module in Personal settings first.' : undefined}
            onClick={() => navigate(module.id)}>{module.label}{disabledPluginIds.includes(module.id) ? ' (hidden)' : ''}</button>)}
        </div>
        {draftPending && <p className="personal-hint">Save or discard your personal-settings changes before opening another module.</p>}
      </section>

      <section className="personal-section" aria-labelledby="personal-storage">
        <h3 id="personal-storage">Local data location</h3>
        {location ? <>
          <p className="personal-hint">{location.development ? 'Development data' : 'Installed app data'}</p>
          <dl>
            <dt>Data folder</dt><dd><code>{location.directory}</code></dd>
            <dt>Database</dt><dd><code>{location.databaseUrl}</code></dd>
          </dl>
        </> : !locationError && <p role="status">Loading data location…</p>}
        {locationError && <p role="alert" className="personal-error">Could not read the data location. {locationError} <button type="button" onClick={() => setLocationRetry(value => value + 1)}>Retry location</button></p>}
      </section>
    </>
  );
}
