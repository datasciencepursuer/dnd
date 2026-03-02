import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode when MOBILE=true (for Capacitor native builds)
  ssr: !process.env.MOBILE,
} satisfies Config;
