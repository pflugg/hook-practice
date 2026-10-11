import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dataset cast lint", () => {
  it("fails on a direct cast, a union cast, and an angle cast", () => {
    const file = join(process.cwd(), "src/ui/cast-probe.ts");
    writeFileSync(
      file,
      [
        'const raw = "nope";',
        "export const direct = raw as LocationId;",
        "export const union = raw as LocationId | undefined;",
        "export const angle = <LocationId>raw;",
        "",
      ].join("\n"),
    );
    try {
      const result = spawnSync("npx", ["eslint", file, "--max-warnings", "0"], { encoding: "utf8" });
      const output = `${result.stdout}\n${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(output.match(/parseLocationId/g)?.length).toBe(3);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
