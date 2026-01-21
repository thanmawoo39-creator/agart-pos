import { db, sqlite } from '../server/lib/db';
import { sql } from 'drizzle-orm';
import {
    sales,
    saleItems,
    tables,
    businessUnits,
    kitchenTickets
} from '../shared/schema';

async function hardResetDatabase() {
    console.log('🚨 HARD RESET INITIATED...');
    console.log('⚠️  This will delete ALL sales data and reset all tables!\n');

    try {
        // Step 1: Disable foreign key constraints
        console.log('🔓 Disabling foreign key constraints...');
        await db.run(sql`PRAGMA foreign_keys = OFF`);
        console.log('✅ Foreign keys disabled');

        // Step 2: Delete in correct order (child tables first)
        console.log('\n🗑️  Deleting data in safe order...');

        // Delete sale_items first (child of sales)
        console.log('  → Deleting sale_items...');
        const saleItemsResult = await db.delete(saleItems);
        console.log(`    ✅ Deleted ${saleItemsResult.changes || 0} sale items`);

        // Delete sales
        console.log('  → Deleting sales...');
        const salesResult = await db.delete(sales);
        console.log(`    ✅ Deleted ${salesResult.changes || 0} sales`);

        // Delete kitchen tickets
        console.log('  → Deleting kitchen tickets...');
        const ticketsResult = await db.delete(kitchenTickets);
        console.log(`    ✅ Deleted ${ticketsResult.changes || 0} kitchen tickets`);

        // Step 3: Reset ALL restaurant tables to available
        console.log('\n🔄 Resetting all restaurant tables...');
        const tablesResult = await db.update(tables).set({
            status: 'available',
            currentOrder: null,
            lastOrdered: null,
            serviceStatus: null,
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Reset ${tablesResult.changes || 0} tables to available`);

        // Step 4: Ensure default BusinessUnit exists
        console.log('\n🏢 Verifying default Business Unit...');
        const existingUnits = await db.select().from(businessUnits);
        const defaultUnit = existingUnits.find(u => u.id === '1');

        if (!defaultUnit) {
            console.log('📝 Creating default Business Unit with ID 1...');
            await db.insert(businessUnits).values({
                id: '1',
                name: 'Main Restaurant',
                type: 'restaurant',
                isActive: 'true',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('✅ Default Business Unit created');
        } else {
            console.log(`✅ Default Business Unit exists: "${defaultUnit.name}"`);
        }

        // Step 5: Re-enable foreign key constraints
        console.log('\n🔒 Re-enabling foreign key constraints...');
        await db.run(sql`PRAGMA foreign_keys = ON`);
        console.log('✅ Foreign keys re-enabled');

        // Final summary
        console.log('\n' + '='.repeat(50));
        console.log('🎉 DATABASE CLEANED SUCCESSFULLY');
        console.log('='.repeat(50));
        console.log('\nSystem Status:');
        console.log('  ✅ Sales Data: Cleared');
        console.log('  ✅ Sale Items: Cleared');
        console.log('  ✅ Kitchen Tickets: Cleared');
        console.log('  ✅ Tables: Reset to Available');
        console.log('  ✅ Business Unit ID 1: Verified');
        console.log('  ✅ Foreign Keys: Re-enabled');
        console.log('\n✨ You can now restart the POS system safely.\n');

    } catch (error) {
        console.error('\n❌ HARD RESET FAILED:');
        console.error(error);

        // Try to re-enable foreign keys even on error
        try {
            console.log('\n🔒 Attempting to re-enable foreign keys...');
            await db.run(sql`PRAGMA foreign_keys = ON`);
            console.log('✅ Foreign keys re-enabled');
        } catch (fkError) {
            console.error('⚠️  Could not re-enable foreign keys:', fkError);
        }

        throw error;
    }
}

// Execute the reset
hardResetDatabase()
    .then(() => {
        console.log('✅ Hard reset completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Hard reset failed. Please check the error above.');
        process.exit(1);
    });
