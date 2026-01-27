import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  ssr: {
    // Externalize konva for SSR to avoid resolution issues
    noExternal: ["konva", "react-konva"],
  },
  optimizeDeps: {
    include: ["konva", "react-konva"],
  },
});
