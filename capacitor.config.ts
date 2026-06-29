import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mobileenglish.app",
  appName: "Mobile English",
  webDir: ".next",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#FDF6E3",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      iosSplashStyle: "DEFAULT",
      iosSplashImmersive: false,
    },
  },
};

export default config;
