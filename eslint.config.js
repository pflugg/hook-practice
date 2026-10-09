import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  console: "readonly",
  fetch: "readonly",
  process: "readonly",
};

const datasetCasts = [
  ["LocationId", "parseLocationId"],
  ["Difficulty", "parseDifficulty"],
  ["TeachTab", "parseTeachTab"],
].flatMap(([typeName, parser]) =>
  ["TSAsExpression", "TSTypeAssertion"].map((node) => ({
    selector: `${node} TSTypeReference[typeName.name='${typeName}']`,
    message: `Parse this value with ${parser} from src/ui/parse.ts. Do not cast a dataset string to ${typeName}.`,
  })),
);

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "verification-evidence/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/ui/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...datasetCasts],
    },
  },
);
