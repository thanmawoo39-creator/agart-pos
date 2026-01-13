import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

const pinSchema = z.object({
    pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});

router.get("/current", async (_req, res) => {
    try {
        res.json(await storage.getCurrentShift());
    } catch (error) {
        res.status(500).json({ error: "Failed to get current shift" });
    }
});

router.post("/clock-in", async (req, res) => {
    try {
        const parsed = pinSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "PIN must be 4 digits" });

        const { pin } = parsed.data;
        const staffMember = await storage.getStaffByPin(pin);
        if (!staffMember) return res.status(401).json({ error: "Invalid PIN" });
        if (staffMember.status === "suspended") {
            return res.status(401).json({ error: "Staff account is suspended" });
        }

        const currentShift = await storage.getCurrentShift();
        if (currentShift.isActive) {
            return res.status(400).json({ error: `${currentShift.staffName} is already clocked in.` });
        }

        const attendance = await storage.clockIn(staffMember.id, staffMember.name);
        res.json({ success: true, attendance, staffName: staffMember.name });
    } catch (error) {
        res.status(500).json({ error: "Failed to clock in" });
    }
});

router.post("/clock-out", async (req, res) => {
    try {
        const parsed = pinSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "PIN must be 4 digits" });

        const { pin } = parsed.data;
        const staffMember = await storage.getStaffByPin(pin);
        if (!staffMember) return res.status(401).json({ error: "Invalid PIN" });

        const currentShift = await storage.getCurrentShift();
        if (!currentShift.isActive) return res.status(400).json({ error: "No active shift" });
        if (currentShift.staffId !== staffMember.id) {
            return res.status(400).json({ error: `Only ${currentShift.staffName} can clock out` });
        }

        const attendance = await storage.clockOut(currentShift.attendanceId!);
        res.json({ success: true, attendance, totalHours: attendance?.totalHours });
    } catch (error) {
        res.status(500).json({ error: "Failed to clock out" });
    }
});

router.get("/report", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = new Date().toISOString().split("T")[0];
            return res.json(await storage.getAttendanceByDate(today));
        }

        res.json(await storage.getAttendanceReport(startDate as string, endDate as string));
    } catch (error) {
        res.status(500).json({ error: "Failed to get attendance report" });
    }
});

router.get("/", async (_req, res) => {
    try {
        res.json(await storage.getAttendance());
    } catch (error) {
        res.status(500).json({ error: "Failed to get attendance" });
    }
});

export default router;
