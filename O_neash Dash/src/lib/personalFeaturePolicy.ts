export interface FeatureSettings {
  disabledPluginIds: readonly string[];
  feeds: { news: boolean; research: boolean; weather: boolean; quotes: boolean };
  analytics: { planner: boolean; sleep: boolean };
}

export type FeedFeature = keyof FeatureSettings['feeds'];

export function pluginEnabled(id: string | null | undefined, disabledIds: readonly string[], ready = true): boolean {
  return id === null || id === 'settings' || (!!id && ready && !disabledIds.includes(id));
}

export function feedEnabled(feature: FeedFeature, settings: FeatureSettings, ready: boolean): boolean {
  return ready && settings.feeds[feature];
}

export function filterAppCategories<T extends { apps: { pluginId?: string }[] }>(
  categories: readonly T[], disabledIds: readonly string[], ready = true,
): T[] {
  return categories.map(category => ({
    ...category,
    apps: category.apps.filter(app => pluginEnabled(app.pluginId, disabledIds, ready)),
  })).filter(category => category.apps.length > 0);
}

export function analyticsSelection(selected: ReadonlySet<string>, enabled: FeatureSettings['analytics'], ready: boolean): 'planner' | 'sleep' | 'combined' | null {
  const planner = ready && enabled.planner && selected.has('planner');
  const sleep = ready && enabled.sleep && selected.has('sleep');
  return planner && sleep ? 'combined' : planner ? 'planner' : sleep ? 'sleep' : null;
}

export function formatHomeClock(now: Date, timeZone: string, locale: string): { time: string; date: string; zone: string } {
  const language = locale === 'system' ? undefined : locale;
  const zone = timeZone === 'system' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZone;
  return {
    time: new Intl.DateTimeFormat(language, { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now),
    date: new Intl.DateTimeFormat(language, { timeZone: zone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now),
    zone,
  };
}
