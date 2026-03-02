import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * In mobile SPA builds (MOBILE=true), React Router's SPA mode rejects
 * server-only exports (loader, action) in route files. This plugin runs
 * before React Router's validation and completely removes those functions
 * (including dynamic imports inside them) so the same route files work
 * for both SSR (web) and SPA (mobile) builds.
 */
function stripServerExportsForMobile(): Plugin {
  // Remove an exported function by skipping its params then counting brace depth
  function removeFunctionBody(code: string, exportName: string): string {
    // Match: export [async] function name(
    const fnPattern = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${exportName}\\s*\\(`
    );
    const match = fnPattern.exec(code);
    if (!match) return code;

    const start = match.index;
    let i = match.index + match[0].length; // Right after the opening (

    // Skip past parameter list by counting parentheses
    // (handles destructured params like { request }: Route.LoaderArgs)
    let parenDepth = 1;
    while (i < code.length && parenDepth > 0) {
      if (code[i] === "(") parenDepth++;
      else if (code[i] === ")") parenDepth--;
      i++;
    }

    // Find the opening { of the function body
    while (i < code.length && code[i] !== "{") i++;

    // Count braces to find the matching }
    let braceDepth = 0;
    while (i < code.length) {
      if (code[i] === "{") braceDepth++;
      else if (code[i] === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          return code.slice(0, start) + "/* [mobile-build] server export removed */" + code.slice(i + 1);
        }
      }
      i++;
    }

    return code;
  }

  return {
    name: "strip-server-exports-mobile",
    enforce: "pre",
    transform(code, id) {
      if (!process.env.MOBILE) return null;

      const normalizedId = id.replace(/\\/g, "/");
      if (!normalizedId.includes("/app/routes/")) return null;

      // Check if this file has a loader or action export
      const hasServerExport =
        /export\s+(async\s+)?function\s+(loader|action)/.test(code) ||
        /export\s+const\s+(loader|action)\s*=/.test(code);
      if (!hasServerExport) return null;

      let result = code;

      // Remove static imports from .server directories
      result = result.replace(
        /^import\s+(?!type\s).*from\s+["'].*\.server.*["'];?\s*$/gm,
        "/* [mobile-build] server import removed */"
      );

      // Completely remove loader and action function bodies
      // (handles dynamic imports like `await import("~/.server/db")` inside them)
      result = removeFunctionBody(result, "loader");
      result = removeFunctionBody(result, "action");

      if (result !== code) {
        return { code: result, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    stripServerExportsForMobile(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  ssr: {
    // Externalize konva for SSR to avoid resolution issues
    noExternal: ["konva", "react-konva"],
  },
  optimizeDeps: {
    include: ["konva", "react-konva"],
  },
});
