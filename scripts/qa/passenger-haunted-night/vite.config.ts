import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const qaRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(qaRoot, "../../..");

// This config is used only by the local QA command, never by the production build.
// Every server function is replaced before bundling; no credentials or backend clients load.
function localFixtures(): Plugin {
  return {
    name: "haunted-night-local-services",
    enforce: "pre",
    resolveId(source) {
      const fn = source.match(/(?:^|\/)([^/]+)\.functions(?:\.ts)?$/);
      if (fn) return `\0haunted-qa-functions:${fn[1]}`;
      if (/(?:^|\/)integrations\/supabase\/client(?:\.ts)?$/.test(source))
        return "\0haunted-qa-supabase";
    },
    load(id) {
      if (id === "\0haunted-qa-supabase")
        return `export const supabase = { auth: { getSession: async () => ({data:{session:{user:{id:'local-qa'}}}}), signOut: async () => ({}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) } };`;
      if (!id.startsWith("\0haunted-qa-functions:")) return;
      const module = id.split(":")[1];
      const source = fs.readFileSync(
        path.join(repoRoot, "src/lib", `${module}.functions.ts`),
        "utf8",
      );
      const names = [...source.matchAll(/export\s+(?:async\s+)?(?:const|function)\s+(\w+)/g)].map(
        (match) => match[1],
      );
      return (
        `import {callLocalFixture} from ${JSON.stringify(path.join(qaRoot, "fixtures.ts"))};\n` +
        names
          .map(
            (name) =>
              `export const ${name} = (input) => callLocalFixture(${JSON.stringify(name)}, input);`,
          )
          .join("\n")
      );
    },
  };
}

export default defineConfig({
  root: qaRoot,
  envDir: qaRoot,
  publicDir: path.join(repoRoot, "public"),
  plugins: [localFixtures(), react(), tailwindcss()],
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "lucide-react",
      "zod",
      "qrcode.react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-slot",
      "clsx",
      "tailwind-merge",
      "@tanstack/react-router",
    ],
  },
  resolve: { alias: { "@": path.join(repoRoot, "src") }, dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 4317, strictPort: true, fs: { allow: [repoRoot] } },
});
