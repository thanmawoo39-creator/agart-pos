import { Router } from "express";
import { storage } from "../storage";
import { staffSchema } from "../../shared/schema";
import { isAuthenticated, requireAdmin } from '../middleware/auth';
import { cache, CACHE_KEYS, CACHE_TTL } from '../lib/cache';

const router = Router();

const getScopedBusinessUnitId = (req: any, res: any): string | null => {
  const businessUnitId = typeof req.query?.businessUnitId === 'string' ? req.query.businessUnitId : '';
  if (!businessUnitId) {
    res.status(400).json({ error: 'businessUnitId is required' });
    return null;
  }

  const userBusinessUnitId = req.user?.businessUnitId;
  const userRole = req.user?.role;
  if (userRole !== 'owner') {
    if (!userBusinessUnitId) {
      res.status(403).json({ error: 'User has no assigned business unit' });
      return null;
    }
    if (businessUnitId !== userBusinessUnitId) {
      res.status(403).json({ error: 'Business unit mismatch' });
      return null;
    }
  }

  return businessUnitId;
};

// Staff Management
router.get("/", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    // Use cache for staff list
    const staff = await cache.getOrFetch(
      CACHE_KEYS.STAFF,
      () => storage.getStaff(),
      CACHE_TTL.MEDIUM
    );
    const scoped = staff.filter((s: any) => (s?.businessUnitId || null) === businessUnitId);
    res.json(scoped.map(({ pin, ...rest }) => rest));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

router.get("/:id", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const businessUnitId = getScopedBusinessUnitId(req, res);
    if (!businessUnitId) return;

    const staffMember = await storage.getStaffMember(req.params.id);
    if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
    if ((staffMember?.businessUnitId || null) !== businessUnitId) return res.status(404).json({ error: "Staff member not found" });
    const { pin, ...safeStaff } = staffMember;
    res.json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

router.post("/", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const parsed = staffSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid staff data", details: parsed.error.errors });
    const staffMember = await storage.createStaff(parsed.data);
    cache.invalidate(CACHE_KEYS.STAFF); // Invalidate cache
    const { pin, ...safeStaff } = staffMember;
    res.status(201).json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: "Failed to create staff member" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const staffMember = await storage.updateStaff(req.params.id, req.body);
    if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
    cache.invalidate(CACHE_KEYS.STAFF); // Invalidate cache
    const { pin, ...safeStaff } = staffMember;
    res.json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: "Failed to update staff member" });
  }
});

router.delete("/:id", isAuthenticated, requireAdmin, async (req, res) => {
  try {
    if (!await storage.deleteStaff(req.params.id)) return res.status(404).json({ error: "Staff member not found" });
    cache.invalidate(CACHE_KEYS.STAFF); // Invalidate cache
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete staff member" });
  }
});

router.post("/:id/suspend", async (req, res) => {
  try {
    const staffMember = await storage.suspendStaff(req.params.id);
    if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
    cache.invalidate(CACHE_KEYS.STAFF); // Invalidate cache
    const { pin, ...safeStaff } = staffMember;
    res.json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: "Failed to suspend staff member" });
  }
});

router.post("/:id/activate", async (req, res) => {
  try {
    const staffMember = await storage.activateStaff(req.params.id);
    if (!staffMember) return res.status(404).json({ error: "Staff member not found" });
    cache.invalidate(CACHE_KEYS.STAFF); // Invalidate cache
    const { pin, ...safeStaff } = staffMember;
    res.json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: "Failed to activate staff member" });
  }
});

export default router;
