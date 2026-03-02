import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bubufulplanet.dnd",
  appName: "DnD Map Editor",
  webDir: "build/client",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    hostname: "bubufulplanet.com",
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    SplashScreen: { launchShowDuration: 2000, backgroundColor: "#111827" },
    Keyboard: { resize: "ionic" },
    StatusBar: { style: "dark", backgroundColor: "#111827" },
  },
};

export default config;
