import { db } from './server/lib/db';
import { staff } from './shared/schema';
import { eq } from 'drizzle-orm';
import { hashPin } from './server/lib/auth';

async function fixAuth() {
  console.log("🚀 Starting password reset for 'Admin' user...");

  try {
    const pin = '123456';
    const hashedPin = hashPin(pin);

    console.log(`🔑 Generated new hash for 'Admin': ${hashedPin}`);

    const [updatedAdmin] = await db.update(staff)
      .set({ pin: hashedPin })
      .where(eq(staff.name, 'admin')) // Targeting 'admin' as created in previous step
      .returning();

    if (updatedAdmin) {
      console.log("✅ Password successfully hashed and saved for Admin");
    } else {
      // If 'admin' user was not found, try 'Admin'
      const [updatedAdminFallback] = await db.update(staff)
        .set({ pin: hashedPin })
        .where(eq(staff.name, 'Admin'))
        .returning();
      if(updatedAdminFallback) {
        console.log("✅ Password successfully hashed and saved for Admin");
      } else {
        console.error("❌ Could not find user 'admin' or 'Admin' to update.");
      }
    }
  } catch (error) {
    console.error("❌ Error during password reset:", error);
  }
}

fixAuth();
