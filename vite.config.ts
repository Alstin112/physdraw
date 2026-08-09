import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {

  // @ts-expect-error process is a nodejs global
  const env = loadEnv(mode, process.cwd(), '');
  const platform = env.VITE_PLATFORM || 'tauri';
  console.log(platform);
  return {
    plugins: [react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: '2023-11' }]
        ]
      }
    })],
    base: '/physdraw/',

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
          protocol: "ws",
          host,
          port: 1421,
        }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
    resolve: {
      extensions: [
        `.${platform}.ts`,
        `.${platform}.tsx`,
        `.${platform}.js`,
        `.${platform}.jsx`,
        ".tsx",
        ".ts",
        ".jsx",
        ".js",
      ]
    }
  }
});
