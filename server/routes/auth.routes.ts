import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Staff Authentication
router.post("/login", async (req, res) => {
  try {
    const { pin, barcode } = req.body;
    let staffMember = null;
    if (pin) staffMember = await storage.getStaffByPin(pin);
    else if (barcode) staffMember = await storage.getStaffByBarcode(barcode);

    if (!staffMember) return res.status(401).json({ error: "Invalid credentials" });
    if (staffMember.status === "suspended") return res.status(401).json({ error: "Staff account is suspended" });

    // Create session
    req.session.user = {
      id: staffMember.id,
      name: staffMember.name,
      role: staffMember.role,
      businessUnitId: staffMember.businessUnitId || undefined,
    };

    const { pin: _, ...safeStaff } = staffMember;
    res.json({ staff: safeStaff, loginTime: new Date().toISOString() });
  } catch (error) {
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

export default router;
