import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { createTutorHandler } from "./server/tutor.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const handler = createTutorHandler({ apiKey: env.OPENAI_API_KEY, budgetPath: env.LUNA_BUDGET_PATH });
  return {
  base: "./",
  plugins: [{
    name: "optional-luna-tutor",
    configureServer(server) { server.middlewares.use("/api/tutor", handler); },
    configurePreviewServer(server) { server.middlewares.use("/api/tutor", handler); },
  }],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  };
});
