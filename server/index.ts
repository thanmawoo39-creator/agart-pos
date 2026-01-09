import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import os from 'os';

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Create automatic backup on server start
async function createStartupBackup() {
  try {
    const dbPath = path.join(process.cwd(), 'sqlite.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupFileName = `POS_Startup_Backup_${timestamp}.db`;
    const backupPath = path.join(process.cwd(), 'backups', backupFileName);
    
    // Ensure backups directory exists
    await fs.mkdir(path.join(process.cwd(), 'backups'), { recursive: true });
    
    // Create backup copy
    await fs.copyFile(dbPath, backupPath);
    console.log(`✅ Startup backup created: ${backupFileName}`);
  } catch (error) {
    console.error('❌ Failed to create startup backup:', error);
  }
}

// Load environment as early as possible using an explicit path resolution so
// the .env file is found regardless of process cwd.
// .env is expected at repository root (one level above /server)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath, override: true });

// Kill any existing process on port 5000 before starting
const port = 5000;
console.log(`Checking for processes on port ${port}...`);

// Use PowerShell for Windows compatibility
exec(
  `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join '\n'"`,
  (_error, stdout) => {
    const pids = (stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (pids.length === 0) {
      console.log(`No process found on port ${port}`);
      return;
    }

    for (const pid of pids) {
      console.log(`Killing process ${pid} on port ${port}`);
      exec(`taskkill /F /PID ${pid}`, (killError) => {
        if (killError) {
          console.log('Failed to kill process:', killError.message);
        } else {
          console.log(`Successfully killed process ${pid}`);
        }
      });
    }
  }
);

if (process.env.GEMINI_API_KEY) {
  console.log('GEMINI_API_KEY Loaded');
}

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
// import { initializeMockData } from "./lib/db";
import { storage } from "./storage";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      name: string;
      role: 'owner' | 'manager' | 'cashier';
    };
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Increase urlencoded body size to allow l‌ေarge base64 image strings
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session middleware for authentication
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'pos-system-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

import { db } from './lib/db';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

(async () => {
  try {
    // Run full Drizzle migrations on startup
    try {
      console.log('Applying database migrations...');
      await migrate(db, { migrationsFolder: "./migrations" });
      console.log('✅ Migrations applied successfully.');
    } catch (err) {
      console.error('❌ Migration error:', err);
      // Depending on the app's needs, you might want to exit if migrations fail.
      // For this use case, we'll log the error and continue, as the server might
      // be able to operate with an older schema for some functionalities.
    }

    await registerRoutes(httpServer, app);

    // Ensure DB seeded (defensive - storage.initialize already calls this,
    // but call again to be robust during hot-reloads)
    // Initialize mock data
    try {
      // await initializeMockData();
    } catch (err) {
      console.error('Error seeding initial data:', err);
    }

    // Verify admin persisted and whether auto clock-in created a shift
    try {
      const staff = await storage.getStaff();
      const admin = staff.find((s) => s.role === 'owner');
      if (admin) {
        console.log(`Verified admin user exists: ${admin.name}`);
      } else {
        console.warn('Admin user not found after seeding. Run npm run reset-admin.');
      }

      const current = await storage.getCurrentShift();
      if (current.isActive) {
        console.log(`Verified active shift: ${current.staffName} started at ${current.clockInTime}`);
      } else {
        console.log('No active shift found after startup');
      }
    } catch (err) {
      console.error('Verification check failed:', err);
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // Serve uploaded files statically using absolute path to project root
    // IMPORTANT: Use process.cwd() to match multer's upload destination
    const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
    app.use('/uploads', express.static(uploadsPath));

    // Ensure uploads directory exists
    fs.mkdir(uploadsPath, { recursive: true }).catch(err => {
      if (err.code !== 'EEXIST') {
        console.error('Failed to create uploads directory:', err);
      }
    });

    // Run startup backup
    createStartupBackup();

    // Serve public folder statically for QR codes and other static assets
    app.use('/qrcodes', express.static(path.join(process.cwd(), 'public', 'qrcodes')));
    app.use(express.static(path.join(process.cwd(), 'public')));

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port: port,
        host: "0.0.0.0",
      },
      () => {
        const ip = getLocalIpAddress();
        log(`Server running on port ${port}.`);
        log(`Access it locally at http://localhost:${port}`);
        log(`Access it on your LAN at http://${ip}:${port}`);
        log(`🔥 IMPORTANT: Make sure to allow Node.js through Windows Firewall if accessing from LAN!`);
      }
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();
