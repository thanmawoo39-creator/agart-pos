import { build as esbuild, type Plugin } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// Plugin to completely ignore vite-related imports in production build
// This prevents "Cannot find package 'vite'" error in production
const ignoreVitePlugin: Plugin = {
  name: "ignore-vite",
  setup(build) {
    // Intercept any imports that reference ./vite (with or without .js extension)
    build.onResolve({ filter: /^\.\/vite(\.js)?$/ }, (args) => {
      return {
        path: args.path,
        namespace: "ignore-vite",
      };
    });

    // Also intercept the vite package itself
    build.onResolve({ filter: /^vite$/ }, (args) => {
      return {
        path: args.path,
        namespace: "ignore-vite",
      };
    });

    // Return an empty module for all vite-related imports
    build.onLoad({ filter: /.*/, namespace: "ignore-vite" }, () => {
      return {
        contents: `
          // Stub module - vite is not available in production
          export function setupVite() {
            console.warn("Vite is not available in production mode");
          }
          export function createServer() {
            console.warn("Vite is not available in production mode");
          }
          export function createLogger() {
            return { info: () => {}, warn: () => {}, error: () => {} };
          }
          export default {};
        `,
        loader: "js",
      };
    });
  },
};

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "dist/index.js",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    plugins: [ignoreVitePlugin],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
