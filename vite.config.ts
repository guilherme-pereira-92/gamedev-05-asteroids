import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/gamedev-05-asteroids/" : "/",
  server: { port: 5177, open: true },
  build: { target: "es2020" },
}));
