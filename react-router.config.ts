import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // To deploy on Vercel, install @vercel/react-router and uncomment:
  // import { vercelPreset } from "@vercel/react-router/dev";
  // presets: [vercelPreset()],
} satisfies Config;
