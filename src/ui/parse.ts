import { LOCATION_IDS, type Difficulty, type LocationId } from "../engine/types";

export type TeachTab = "brief" | "coach" | "reasons";

const DIFFICULTIES = ["easy", "normal"] as const;
const TEACH_TABS = ["brief", "coach", "reasons"] as const;

function member<T extends string>(list: readonly T[], value: string | undefined): T | null {
  if (value === undefined) return null;
  for (const item of list) {
    if (item === value) return item;
  }
  return null;
}

export function parseLocationId(value: string | undefined): LocationId | null {
  return member(LOCATION_IDS, value);
}

export function parseDifficulty(value: string | undefined): Difficulty | null {
  return member(DIFFICULTIES, value);
}

export function parseTeachTab(value: string | undefined): TeachTab | null {
  return member(TEACH_TABS, value);
}
