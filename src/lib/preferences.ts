import { getPreferenceValues } from "@raycast/api";

export function keepShelfAfterCompletion(): boolean {
  const prefs = getPreferenceValues();
  return Boolean(prefs.keepShelfAfterCompletion);
}
