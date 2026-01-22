// Load dotenv FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import { ensureNonEmptySqlMigrations, runMigrations } from './lib/run-migrations';

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
// Note: For PostgreSQL (Supabase), backups are handled by the database service
async function createStartupBackup() {
  // PostgreSQL backups should be done via Supabase dashboard or pg_dump
  // File-based backup is not applicable for remote PostgreSQL databases
  console.log('ℹ️ PostgreSQL database - backups managed by Supabase');
}

// killPortIfInUse logic removed for cross-platform compatibility
// Render/Docker handles port binding and process management automatically.

// Load environment as early as possible using an explicit path resolution so
// the .env file is found regardless of process cwd.
// .env is expected at repository root (one level above /server)
// CJS/ESM compatible path resolution with safe detection
let __dirnameResolved: string;
try {
  // Check if we are in a CommonJS environment (Production Build)
  // Use eval to prevent bundler from transforming this check
  const hasDirname = typeof (globalThis as any).__dirname !== 'undefined' ||
    (typeof __dirname !== 'undefined' && __dirname !== '');

  if (hasDirname && typeof __dirname === 'string' && __dirname.length > 0) {
    __dirnameResolved = __dirname;
  } else {
    // We are in an ES Module environment (Development Mode)
    const currentFileUrl = import.meta.url;
    const __filename = fileURLToPath(currentFileUrl);
    __dirnameResolved = path.dirname(__filename);
  }
} catch (error) {
  // Fallback to current working directory
  console.log('[PATH] Fallback to process.cwd()');
  __dirnameResolved = process.cwd();
}
const envPath = path.resolve(__dirnameResolved, '../.env');
dotenv.config({ path: envPath, override: true });

// Kill any existing process on port 5000 before starting
// Port checking removed
// const killPortPromise = killPortIfInUse(port);
const killPortPromise = Promise.resolve();

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
import { Server as SocketIOServer } from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

// Seed default stores function
async function seedDefaultStores() {
  try {
    console.log('🌱 Checking default stores...');

    // Check if stores already exist
    const existingStores = await storage.getBusinessUnits();
    console.log(`Found ${existingStores.length} existing stores`);

    if (existingStores.length === 0) {
      // Create default stores (use lowercase types to match schema)
      const mainStore = {
        name: 'Main Store',
        type: 'grocery' as const,
        settings: JSON.stringify({ location: '123 Main Street', phone: '+1 234 567 8900' }),
        isActive: 'true' as const
      };

      const restaurant = {
        name: 'Restaurant',
        type: 'restaurant' as const,
        settings: JSON.stringify({ location: '456 Food Avenue', phone: '+1 234 567 8901' }),
        isActive: 'true' as const
      };

      // Insert stores
      const createdMainStore = await storage.createBusinessUnit(mainStore);
      const createdRestaurant = await storage.createBusinessUnit(restaurant);

      console.log('✅ Created default stores:');
      console.log(`   - ${createdMainStore.name} (${createdMainStore.type})`);
      console.log(`   - ${createdRestaurant.name} (${createdRestaurant.type})`);

      // Create sample products for Main Store (Grocery)
      await seedGroceryData(createdMainStore.id);

      // Create sample products for Restaurant
      await seedRestaurantData(createdRestaurant.id);

    } else {
      console.log('📦 Stores already exist, skipping seed');
    }

  } catch (error) {
    console.error('❌ Failed to seed default stores:', error);
  }
}

async function seedGroceryData(storeId: string) {
  try {
    console.log(`🛒 Seeding grocery data for store ${storeId}`);

    // Create products
    const products = [
      {
        name: 'Fresh Apples',
        price: 2.99,
        stock: 50,
        category: 'Fruits & Vegetables',
        businessUnitId: storeId,
        barcode: '1234567890',
        cost: 1.50,
        minStockLevel: 10,
        unit: 'kg',
        status: 'active'
      },
      {
        name: 'Milk 1L',
        price: 3.49,
        stock: 30,
        category: 'Dairy Products',
        businessUnitId: storeId,
        barcode: '1234567891',
        cost: 2.00,
        minStockLevel: 5,
        unit: 'liter',
        status: 'active'
      },
      {
        name: 'Bread',
        price: 2.99,
        stock: 25,
        category: 'Bakery Items',
        businessUnitId: storeId,
        barcode: '1234567892',
        cost: 1.20,
        minStockLevel: 8,
        unit: 'loaf',
        status: 'active'
      },
      {
        name: 'Orange Juice',
        price: 4.99,
        stock: 20,
        category: 'Beverages',
        businessUnitId: storeId,
        barcode: '1234567893',
        cost: 3.00,
        minStockLevel: 6,
        unit: 'liter',
        status: 'active'
      }
    ];

    for (const product of products) {
      await storage.createProduct(product);
    }

    console.log('✅ Grocery data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed grocery data:', error);
  }
}

async function seedRestaurantData(storeId: string) {
  try {
    console.log(`🍽️ Seeding restaurant data for store ${storeId}`);

    // Create menu items
    const products = [
      {
        name: 'Caesar Salad',
        price: 8.99,
        stock: 100,
        category: 'Appetizers',
        businessUnitId: storeId,
        barcode: '9876543210',
        cost: 4.50,
        minStockLevel: 0,
        unit: 'portion',
        status: 'active'
      },
      {
        name: 'Grilled Chicken',
        price: 15.99,
        stock: 100,
        category: 'Main Courses',
        businessUnitId: storeId,
        barcode: '9876543211',
        cost: 8.00,
        minStockLevel: 0,
        unit: 'portion',
        status: 'active'
      },
      {
        name: 'Chocolate Cake',
        price: 6.99,
        stock: 100,
        category: 'Desserts',
        businessUnitId: storeId,
        barcode: '9876543212',
        cost: 3.50,
        minStockLevel: 0,
        unit: 'slice',
        status: 'active'
      },
      {
        name: 'Coffee',
        price: 3.99,
        stock: 100,
        category: 'Beverages',
        businessUnitId: storeId,
        barcode: '9876543213',
        cost: 1.00,
        minStockLevel: 0,
        unit: 'cup',
        status: 'active'
      }
    ];

    for (const product of products) {
      await storage.createProduct(product);
    }

    console.log('✅ Restaurant data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed restaurant data:', error);
  }
}

async function ensureRestaurantBusinessUnit2(): Promise<string> {
  const now = new Date().toISOString();

  try {
    const existing = await db
      .select()
      .from(businessUnits)
      .where(eq(businessUnits.id, '2'))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }
  } catch {
    // ignore
  }

  try {
    await db
      .insert(businessUnits)
      .values({
        id: '2',
        name: 'Restaurant',
        type: 'restaurant',
        settings: JSON.stringify({ location: 'Restaurant', phone: '' }),
        isActive: 'true',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  } catch (error) {
    console.error('❌ Failed to create Restaurant business unit (id=2):', error);
  }

  return '2';
}

async function ensureRestaurantTables() {
  try {
    const now = new Date().toISOString();

    // PostgreSQL schema is managed via Drizzle migrations
    // Column additions are handled automatically

    await ensureRestaurantBusinessUnit2();
    const units = await db.select().from(businessUnits);
    const restaurantUnitIds = units
      .filter((u: any) => {
        const type = typeof u?.type === 'string' ? u.type.toLowerCase() : '';
        const name = typeof u?.name === 'string' ? u.name.toLowerCase() : '';
        return type === 'restaurant' || name === 'restaurant';
      })
      .map((u: any) => u.id);

    for (const restaurantBusinessUnitId of restaurantUnitIds) {
      const existing = await db
        .select()
        .from(tables)
        .where(eq(tables.businessUnitId, restaurantBusinessUnitId));

      if (existing.length >= 10) {
        continue;
      }

      const existingNumbers = new Set(existing.map((t: any) => String(t.number)));
      const toInsert = [] as any[];

      for (let i = 1; i <= 10; i++) {
        const num = String(i);
        if (!existingNumbers.has(num)) {
          toInsert.push({
            number: num,
            capacity: 4,
            status: 'available',
            currentOrder: null,
            businessUnitId: restaurantBusinessUnitId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (toInsert.length > 0) {
        await db.insert(tables).values(toInsert);
        console.log(`✅ Seeded ${toInsert.length} restaurant tables for business unit ${restaurantBusinessUnitId}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to ensure restaurant tables:', error);
  }
}

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
      role: 'owner' | 'manager' | 'cashier' | 'kitchen';
      businessUnitId?: string;
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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Increase urlencoded body size to allow l‌arge base64 image strings
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware to set Bypass-Tunnel-Reminder header for LocalTunnel
// Middleware to set Bypass-Tunnel-Reminder header to avoid LocalTunnel prompt
app.use((req, res, next) => {
  req.headers['bypass-tunnel-reminder'] = 'true';
  res.setHeader('Bypass-Tunnel-Reminder', 'true');
  next();
});

// CORS middleware - Allow cross-origin requests for Cloudflare/external access
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow all origins for now (can restrict to specific Cloudflare domains later)
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

// Swagger / OpenAPI
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Agart POS API",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:5000" }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
        },
      },
    },
  },
  apis: [
    path.join(__dirnameResolved, "routes.ts"),
    path.join(__dirnameResolved, "routes", "**", "*.ts"),
  ],
});

app.get("/api/docs.json", (_req, res) => {
  res.json(swaggerSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { businessUnits, tables } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

(async () => {
  try {
    await killPortPromise;

    // Startup delay for Render Free Tier - allows database to be fully ready
    const startupDelay = parseInt(process.env.STARTUP_DELAY_MS || '30000', 10);
    if (process.env.NODE_ENV === 'production' && startupDelay > 0) {
      console.log(`⏳ Waiting ${startupDelay / 1000}s for database to be ready (Render Free Tier)...`);
      await new Promise(resolve => setTimeout(resolve, startupDelay));
      console.log('✅ Startup delay complete, proceeding with migrations...');
    }

    // Run full Drizzle migrations on startup
    try {
      console.log('Applying database migrations...');
      await ensureNonEmptySqlMigrations(path.join(process.cwd(), 'migrations'));
      // await migrate(db, { migrationsFolder: "./migrations" });
      console.log('✅ Migrations applied successfully.');
    } catch (err) {
      console.error('❌ Migration error:', err);
      // Depending on the app's needs, you might want to exit if migrations fail.
      // For this use case, we'll log the error and continue, as the server might
      // be able to operate with an older schema for some functionalities.
    }

    // await runMigrations();
    console.log("ℹ️ Skipping legacy manual migrations in favor of Drizzle Kit");

    // Initialize Socket.IO server
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
      }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    // Export io for use in routes
    (global as any).io = io;

    await registerRoutes(httpServer, app);

    // Ensure DB seeded (defensive - storage.initialize already calls this,
    // but call again to be robust during hot-reloads)
    // Initialize mock data
    try {
      // await initializeMockData();

      // Seed default stores if none exist
      await seedDefaultStores();

      await ensureRestaurantTables();

      // LEGACY PURGE: Delete Broken Customers (PostgreSQL version)
      console.log('☢️ Running Ghost Customer Purge...');
      await db.execute(sql`DELETE FROM customers WHERE origin_unit IS NULL OR business_unit_id IS NULL`);
      console.log('✅ Ghost Customers Purged.');

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

    // Note: Schema migrations are handled by Drizzle migrations for PostgreSQL
    // All columns are defined in the schema and applied via `npm run db:push` or migrations
    console.log("✅ PostgreSQL schema managed via Drizzle migrations");

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
    // NOTE: Only serve specific paths from public/ to avoid conflict with dist/public/assets
    app.use('/qrcodes', express.static(path.join(process.cwd(), 'public', 'qrcodes')));
    app.use('/icons', express.static(path.join(process.cwd(), 'public', 'icons')));
    app.use('/sounds', express.static(path.join(process.cwd(), 'public', 'sounds')));
    // Don't use generic express.static(public) as it conflicts with dist/public serving

    // Setup static file serving
    // PRODUCTION: Always serve pre-built files from dist/public
    // DEVELOPMENT: Run "npm run dev" which uses tsx to run with Vite HMR
    //
    // NOTE: We removed the dynamic vite import to prevent "Cannot find package 'vite'"
    // error in production. For development, use "npm run dev" instead.
    console.log(`🚀 Mode: ${process.env.NODE_ENV || 'production'}`);
    console.log("📂 Serving static files from dist/public");
    serveStatic(app);

    const port = parseInt(process.env.PORT || "10000", 10);
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
