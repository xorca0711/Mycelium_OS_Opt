import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

export interface DataLocation {
  directory: string;
  databaseUrl: string;
  development: boolean;
}

let locationPromise: Promise<DataLocation> | undefined;

export function getDataLocation(): Promise<DataLocation> {
  locationPromise ??= invoke<DataLocation>('get_data_location').catch(error => {
    locationPromise = undefined;
    throw error;
  });
  return locationPromise;
}

export async function dataSubdirectory(
  directory: 'journal-images' | 'notes-images' | 'wardrobe-images' | 'filmneg-images',
): Promise<string> {
  return join((await getDataLocation()).directory, directory);
}
