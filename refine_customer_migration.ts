
import { db } from "./server/lib/db";
import { sql } from "drizzle-orm";

async function refineMigration() {
    console.log("Starting refinement of customer origins...");

    try {
        // 1. Restaurant Customers (Unit 2)
        console.log("Updating Restaurant Customers (Unit 2)...");
        const res2 = await db.run(sql`
      UPDATE customers 
      SET origin_unit = '2' 
      WHERE business_unit_id = '2'
    `);
        console.log(`Updated Unit 2 customers. Changes: ${JSON.stringify(res2)}`);

        // 2. Main Store Customers (Unit 1 OR NULL)
        // The user said: WHERE business_unit_id = '1' OR origin_unit IS NULL
        // My previous script set origin_unit to '1' if it was null.
        // So checking origin_unit IS NULL might catch fewer rows now, but ensuring business_unit_id='1' are set to '1' is good.
        // Also, if previous script set some '2' customers to '1' (unlikely if business_unit_id was '2'), this fixes it.
        // Let's explicitly follow the logic strictly.

        console.log("Updating Main Store Customers (Unit 1 or NULL)...");
        const res1 = await db.run(sql`
      UPDATE customers 
      SET origin_unit = '1' 
      WHERE business_unit_id = '1' OR origin_unit IS NULL
    `);
        console.log(`Updated Unit 1 customers. Changes: ${JSON.stringify(res1)}`);

    } catch (error) {
        console.error("Error refining migration:", error);
    }

    console.log("Refinement finished.");
}

refineMigration();
