import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // Determine the correct path to dist/public
  // In production, dist/index.js is at repo-root/dist/index.js
  // and dist/public is at repo-root/dist/public
  let distPath: string;

  // Check if __dirname is available (CommonJS build)
  if (typeof __dirname !== "undefined" && __dirname) {
    // Production: __dirname is dist/, so public is at dist/public
    distPath = path.resolve(__dirname, "public");
  } else {
    // ESM fallback
    const __filename = fileURLToPath(import.meta.url);
    const __dirnameResolved = path.dirname(__filename);
    distPath = path.resolve(__dirnameResolved, "..", "dist", "public");
  }

  // Also check process.cwd()/dist/public as fallback
  if (!fs.existsSync(distPath)) {
    distPath = path.resolve(process.cwd(), "dist", "public");
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  console.log(`📂 Serving static files from: ${distPath}`);

  // Serve static files with correct MIME types
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Ensure CSS files have correct MIME type
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
      // Ensure JS files have correct MIME type
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
