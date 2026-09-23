import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "@backend": fileURLToPath(new URL("./backend", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts", "backend/**/*.test.ts", "eval/**/*.test.ts"], restoreMocks: true },
});
