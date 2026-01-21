
import { db } from "../server/lib/db";
import { products, cateringProducts } from "../shared/schema";
import { like, or } from "drizzle-orm";

async function syncBiryani() {
    console.log("🔄 SYNCING BIRYANI PRODUCTS...");

    try {
        // 1. Sync Regular Products (POS)
        // Find all products with "Biryani" or "ဒံပေါက်"
        const biryaniProducts = await db.select().from(products)
            .where(or(
                like(products.name, "%Biryani%"),
                like(products.name, "%ဒံပေါက်%"), // Burmese for Biryani
                like(products.name, "%Danpauk%")
            ));

        console.log(`Found ${biryaniProducts.length} POS Biryani products.`);

        if (biryaniProducts.length > 0) {
            await db.update(products)
                .set({ isShared: true })
                .where(or(
                    like(products.name, "%Biryani%"),
                    like(products.name, "%ဒံပေါက်%"),
                    like(products.name, "%Danpauk%")
                ))
                .run(); // Ensure immediate execution
            console.log("✅ Updated POS products to isShared=true");
        }

        // 2. Sync Catering Products (Order Manager)
        const cateringBiryani = await db.select().from(cateringProducts)
            .where(or(
                like(cateringProducts.label, "%Biryani%"),
                like(cateringProducts.label, "%ဒံပေါက်%"),
                like(cateringProducts.label, "%Danpauk%")
            ));

        console.log(`Found ${cateringBiryani.length} Catering Biryani products.`);

        if (cateringBiryani.length > 0) {
            await db.update(cateringProducts)
                .set({ isShared: true })
                .where(or(
                    like(cateringProducts.label, "%Biryani%"),
                    like(cateringProducts.label, "%ဒံပေါက်%"),
                    like(cateringProducts.label, "%Danpauk%")
                ))
                .run();
            console.log("✅ Updated Catering products to isShared=true");
        }

        // 3. Fallback: If no catering products exist yet, seed them as shared
        if (cateringBiryani.length === 0) {
            console.log("⚠️ No existing Catering Biryani products found. You might need to seed them first.");
        }

    } catch (error) {
        console.error("❌ Error syncing Biryani:", error);
    }
}

syncBiryani();
