import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rabbitmountain.solitaire',
  appName: 'mySolitaireGame',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
