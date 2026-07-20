import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const envRoot = path.resolve(__dirname, "..");
  const env = loadEnv(mode, envRoot, "");
  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const functionsTarget = supabaseUrl ? `${supabaseUrl}/functions/v1` : "";

  return {
    envDir: envRoot,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: functionsTarget
      ? {
          proxy: {
            "/api": {
              target: functionsTarget,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/api/, ""),
            },
          },
        }
      : undefined,
  };
});


