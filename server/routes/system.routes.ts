import { Router } from "express";
import { db } from "../lib/db";
import { businessUnits } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * 🚨 SYSTEM HEALTH CHECK ENDPOINT
 * Verifies critical system components before operations
 */
router.get("/health-check", async (req, res) => {
    const healthStatus = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        checks: {} as Record<string, { status: string; message?: string }>,
    };

    try {
        // Check 1: Database Connection
        try {
            await db.select().from(businessUnits).limit(1);
            healthStatus.checks.database = {
                status: "✅ OK",
                message: "Database connection successful",
            };
        } catch (error) {
            healthStatus.checks.database = {
                status: "❌ FAILED",
                message: `Database error: ${error instanceof Error ? error.message : 'Unknown'}`,
            };
            healthStatus.status = "unhealthy";
        }

        // Check 2: Business Unit ID 1 Exists
        try {
            const units = await db.select().from(businessUnits).where(eq(businessUnits.id, "1"));
            if (units.length > 0) {
                healthStatus.checks.businessUnit = {
                    status: "✅ OK",
                    message: `Default Business Unit (ID: 1) exists - "${units[0].name}"`,
                };
            } else {
                healthStatus.checks.businessUnit = {
                    status: "⚠️ WARNING",
                    message: "Default Business Unit (ID: 1) not found. Run hard-reset script.",
                };
                healthStatus.status = "degraded";
            }
        } catch (error) {
            healthStatus.checks.businessUnit = {
                status: "❌ FAILED",
                message: `Business unit check failed: ${error instanceof Error ? error.message : 'Unknown'}`,
            };
            healthStatus.status = "unhealthy";
        }

        // Check 3: Printer Connection (Mock)
        healthStatus.checks.printer = {
            status: "✅ OK (Mock)",
            message: "Printer check not implemented - assuming OK",
        };

        // Check 4: Cloudflare Tunnel (Mock check - check if we can reach ourselves)
        try {
            const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL || "Not configured";
            healthStatus.checks.cloudflareTunnel = {
                status: tunnelUrl !== "Not configured" ? "✅ CONFIGURED" : "⚠️ NOT CONFIGURED",
                message: `Tunnel URL: ${tunnelUrl}`,
            };
        } catch (error) {
            healthStatus.checks.cloudflareTunnel = {
                status: "❌ FAILED",
                message: "Tunnel check failed",
            };
        }

        // Overall status code
        const statusCode = healthStatus.status === "healthy" ? 200 : healthStatus.status === "degraded" ? 207 : 503;

        res.status(statusCode).json(healthStatus);
    } catch (error) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error during health check",
        });
    }
});

export default router;
