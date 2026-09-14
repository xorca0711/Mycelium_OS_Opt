import type { ReactNode } from 'react';
import { usePersonalSettingsStore } from '../store/usePersonalSettingsStore';
import { feedEnabled, type FeedFeature } from './personalFeaturePolicy';

/** Recheck at the network boundary too, so delayed retries honor a newly disabled feed. */
export function canFetchFeed(feature: FeedFeature): boolean {
  const { settings, loaded, error } = usePersonalSettingsStore.getState();
  return feedEnabled(feature, settings, loaded && !error);
}

export function FeedGate({ feature, children }: { feature: FeedFeature; children: ReactNode }) {
  const allowed = usePersonalSettingsStore(state => feedEnabled(feature, state.settings, state.loaded && !state.error));
  return allowed ? children : null;
}
