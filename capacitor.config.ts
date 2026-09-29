import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rabbitmountain.solitaire",
  appName: "Solitaire Collection",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
