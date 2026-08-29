import { SettingsSchema, type Settings } from "@studio/shared";
import { paths, readJsonFile, writeJsonFile } from "../store.ts";

let current: Settings = SettingsSchema.parse({});

export async function loadSettings(): Promise<void> {
  const stored = await readJsonFile<unknown>(paths.settings, {});
  const parsed = SettingsSchema.safeParse(stored);
  current = parsed.success ? parsed.data : SettingsSchema.parse({});
}

export function getSettings(): Settings {
  return current;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  current = SettingsSchema.parse({ ...current, ...patch });
  await writeJsonFile(paths.settings, current);
  return current;
}
