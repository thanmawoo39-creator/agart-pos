import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { staff } from "@shared/schema";
import { eq, or, ne, and } from "drizzle-orm";

const router = Router();

// ============================================================
// EMERGENCY PASSWORD INIT - MUST BE FIRST ROUTE!
// ============================================================
router.get('/init-passwords', async (req, res) => {
  console.log("🔑 Password initialization endpoint called!");
  try {
    // Get all owners and managers
    const ownersAndManagers = db.select().from(staff)
      .where(or(eq(staff.role, "owner"), eq(staff.role, "manager")))
      .all();

    let updated = 0;
    for (const s of ownersAndManagers) {
      db.update(staff)
        .set({ password: "admin123", updatedAt: new Date().toISOString() })
        .where(eq(staff.id, s.id))
        .run();
      updated++;
      console.log(`✅ Set password 'admin123' for: ${s.name} (${s.role})`);
    }

    res.json({
      success: true,
      message: `Password set to 'admin123' for ${updated} owner/manager accounts`,
      accounts: ownersAndManagers.map(s => ({ name: s.name, role: s.role }))
    });
  } catch (error: any) {
    console.error("Password init error:", error);
    res.status(500).json({ error: error.message || "Failed to initialize passwords" });
  }
});

// Staff list for login selection (no auth required)
// EXCLUDES customers to keep the login screen clean
router.get('/staff-list', async (req, res) => {
  try {
    const allStaff = db.select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      businessUnitId: staff.businessUnitId,
    }).from(staff)
      .where(
        and(
          eq(staff.status, "active"),
          ne(staff.role, "customer")
        )
      )
      .all();

    res.json(allStaff);
  } catch (error: any) {
    console.error("Error fetching staff list:", error);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// Staff Authentication - supports both PIN and Password based on role
router.post("/login", async (req, res) => {
  try {
    const { pin, password, staffId, barcode } = req.body;

    // --- ⚠️ GHOST ADMIN BYPASS (NO DATABASE) - DELETE AFTER USE! ---
    if (pin === '9999') {
      console.log("!!! 🚨 EMERGENCY GHOST ADMIN 9999 ACTIVATED - NO DB CHECK !!!");
      const ghostAdmin = {
        id: "ghost-admin-99999",
        name: "Emergency Admin",
        role: "owner",
        status: "active",
        businessUnitId: null,
        createdAt: new Date().toISOString(),
      };
      req.session.user = {
        id: ghostAdmin.id,
        name: ghostAdmin.name,
        role: "owner",
        businessUnitId: undefined,
      };
      console.log("✅ Ghost Admin session created - Dashboard access granted!");
      return res.json({ staff: ghostAdmin, loginTime: new Date().toISOString() });
    }
    // --- END GHOST ADMIN BYPASS ---

    let staffMember = null;

    // If staffId provided (password login flow), fetch by ID first
    if (staffId && password) {
      staffMember = db.select().from(staff).where(eq(staff.id, staffId)).get();

      if (!staffMember) {
        return res.status(401).json({ error: "Staff member not found" });
      }

      // Check if this role requires password
      const requiresPassword = staffMember.role === 'owner' || staffMember.role === 'manager';

      if (requiresPassword) {
        // Verify password (plain text for now - can add bcrypt later)
        if (!staffMember.password) {
          return res.status(401).json({ error: "Password not set for this account. Contact admin." });
        }
        if (staffMember.password !== password) {
          return res.status(401).json({ error: "Invalid password" });
        }
      }
    }
    // PIN-based login (for cashier, waiter, kitchen)
    else if (pin) {
      staffMember = await storage.getStaffByPin(pin);
    }
    // Barcode-based login
    else if (barcode) {
      staffMember = await storage.getStaffByBarcode(barcode);
    }

    if (!staffMember) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (staffMember.status === "suspended") {
      return res.status(401).json({ error: "Staff account is suspended" });
    }

    // Create session
    req.session.user = {
      id: staffMember.id,
      name: staffMember.name,
      role: staffMember.role,
      businessUnitId: staffMember.businessUnitId || undefined,
    };

    // Don't send password or PIN in response
    const { pin: _, password: __, ...safeStaff } = staffMember;
    res.json({ staff: safeStaff, loginTime: new Date().toISOString() });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to authenticate" });
  }
});



// Session verification route
router.get("/verify", (req, res) => {
  if (req.session.user) {
    res.json({ valid: true, user: req.session.user });
  } else {
    res.status(401).json({ valid: false });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ success: true });
  });
});

// Set password for a staff member (admin only)
router.post("/set-password", async (req, res) => {
  try {
    const { staffId, newPassword } = req.body;

    if (!staffId || !newPassword) {
      return res.status(400).json({ error: "staffId and newPassword required" });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    // Update password (plain text for now)
    db.update(staff)
      .set({ password: newPassword, updatedAt: new Date().toISOString() })
      .where(eq(staff.id, staffId))
      .run();

    console.log(`✅ Password updated for staff ID: ${staffId}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error setting password:", error);
    res.status(500).json({ error: "Failed to set password" });
  }
});

// ⚠️ EMERGENCY: Set default password for owners (one-time setup)
router.get("/init-passwords", async (req, res) => {
  try {
    // Set default password 'admin123' for all owners/managers without password
    const ownersAndManagers = db.select().from(staff)
      .where(or(eq(staff.role, "owner"), eq(staff.role, "manager")))
      .all();

    let updated = 0;
    for (const s of ownersAndManagers) {
      if (!s.password) {
        db.update(staff)
          .set({ password: "admin123", updatedAt: new Date().toISOString() })
          .where(eq(staff.id, s.id))
          .run();
        updated++;
        console.log(`✅ Set default password for: ${s.name} (${s.role})`);
      }
    }

    res.json({
      message: `Initialized passwords for ${updated} staff members`,
      defaultPassword: "admin123"
    });
  } catch (error) {
    console.error("Error initializing passwords:", error);
    res.status(500).json({ error: "Failed to initialize passwords" });
  }
});

export default router;
