import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agartpos.app',
  appName: 'Agart POS',
  webDir: 'dist/public', // 'www' လို့ ဖြစ်မနေစေရပါ
  bundledWebRuntime: false
};

export default config;