import { LOCATION_IDS, type Difficulty, type LocationId } from "../engine/types";

export type TeachTab = "brief" | "coach" | "reasons";

const LOCATIONS: readonly string[] = LOCATION_IDS;
const DIFFICULTIES: readonly string[] = ["easy", "normal"];
const TEACH_TABS: readonly string[] = ["brief", "coach", "reasons"];

export function parseLocationId(value: string | undefined): LocationId | null {
  if (value !== undefined && LOCATIONS.includes(value)) return value as LocationId;
  return null;
}

export function parseDifficulty(value: string | undefined): Difficulty | null {
  if (value !== undefined && DIFFICULTIES.includes(value)) return value as Difficulty;
  return null;
}

export function parseTeachTab(value: string | undefined): TeachTab | null {
  if (value !== undefined && TEACH_TABS.includes(value)) return value as TeachTab;
  return null;
}
