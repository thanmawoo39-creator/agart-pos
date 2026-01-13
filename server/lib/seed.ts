import { db } from './db';
import { products, customers, staff, businessUnits, tables } from '../../shared/schema';
import { eq } from 'drizzle-orm';

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if data already exists
    const existingProducts = await db.select().from(products).limit(1);
    if (existingProducts.length > 0) {
      console.log('📦 Database already contains data, skipping seed');
      return;
    }

    // Create default business units
    console.log('🏪 Creating business units...');
    const mainStore = await db.insert(businessUnits).values({
      name: 'Main Store',
      type: 'Grocery',
      settings: JSON.stringify({ location: '123 Main Street', phone: '+1 234 567 8900' }),
      isActive: 'true',
    }).returning();

    const restaurant = await db.insert(businessUnits).values({
      name: 'Restaurant',
      type: 'Restaurant',
      settings: JSON.stringify({ location: '456 Food Avenue', phone: '+1 234 567 8901' }),
      isActive: 'true',
    }).returning();

    // Create default admin staff
    console.log('👤 Creating admin staff...');
    await db.insert(staff).values({
      name: 'Admin',
      pin: '0000',
      role: 'owner',
      status: 'active',
      businessUnitId: mainStore[0].id,
    });

    // Create sample products for Main Store
    console.log('🛒 Creating grocery products...');
    const groceryProducts = [
      {
        name: 'Fresh Apples',
        price: 2.99,
        cost: 1.50,
        stock: 50,
        minStockLevel: 10,
        unit: 'kg',
        category: 'Fruits & Vegetables',
        barcode: '1234567890',
        businessUnitId: mainStore[0].id,
        status: 'active',
      },
      {
        name: 'Milk 1L',
        price: 3.49,
        cost: 2.00,
        stock: 30,
        minStockLevel: 5,
        unit: 'liter',
        category: 'Dairy Products',
        barcode: '1234567891',
        businessUnitId: mainStore[0].id,
        status: 'active',
      },
      {
        name: 'Bread',
        price: 2.99,
        cost: 1.20,
        stock: 25,
        minStockLevel: 8,
        unit: 'loaf',
        category: 'Bakery Items',
        barcode: '1234567892',
        businessUnitId: mainStore[0].id,
        status: 'active',
      },
      {
        name: 'Orange Juice',
        price: 4.99,
        cost: 3.00,
        stock: 20,
        minStockLevel: 6,
        unit: 'liter',
        category: 'Beverages',
        barcode: '1234567893',
        businessUnitId: mainStore[0].id,
        status: 'active',
      },
    ];

    await db.insert(products).values(groceryProducts);

    // Create sample menu items for Restaurant
    console.log('🍽️ Creating restaurant menu items...');
    const restaurantProducts = [
      {
        name: 'Caesar Salad',
        price: 8.99,
        cost: 4.50,
        stock: 100,
        minStockLevel: 0,
        unit: 'portion',
        category: 'Appetizers',
        barcode: '9876543210',
        businessUnitId: restaurant[0].id,
        status: 'active',
      },
      {
        name: 'Grilled Chicken',
        price: 15.99,
        cost: 8.00,
        stock: 100,
        minStockLevel: 0,
        unit: 'portion',
        category: 'Main Courses',
        barcode: '9876543211',
        businessUnitId: restaurant[0].id,
        status: 'active',
      },
      {
        name: 'Chocolate Cake',
        price: 6.99,
        cost: 3.50,
        stock: 100,
        minStockLevel: 0,
        unit: 'slice',
        category: 'Desserts',
        barcode: '9876543212',
        businessUnitId: restaurant[0].id,
        status: 'active',
      },
      {
        name: 'Coffee',
        price: 3.99,
        cost: 1.00,
        stock: 100,
        minStockLevel: 0,
        unit: 'cup',
        category: 'Beverages',
        barcode: '9876543213',
        businessUnitId: restaurant[0].id,
        status: 'active',
      },
    ];

    await db.insert(products).values(restaurantProducts);

    // Create restaurant tables
    console.log('🪑 Creating restaurant tables...');
    const restaurantTables = Array.from({ length: 10 }, (_, i) => ({
      number: `T${i + 1}`,
      capacity: 4,
      status: 'available' as const,
      businessUnitId: restaurant[0].id,
    }));

    await db.insert(tables).values(restaurantTables);

    // Create sample customers
    console.log('👥 Creating sample customers...');
    const sampleCustomers = [
      {
        name: 'John Doe',
        phone: '+1 234 567 8901',
        email: 'john.doe@email.com',
        creditLimit: 500,
        currentBalance: 0,
        loyaltyPoints: 100,
        riskTag: 'low' as const,
        status: 'active',
      },
      {
        name: 'Jane Smith',
        phone: '+1 234 567 8902',
        email: 'jane.smith@email.com',
        creditLimit: 1000,
        currentBalance: 250,
        loyaltyPoints: 250,
        riskTag: 'high' as const,
        status: 'active',
      },
    ];

    await db.insert(customers).values(sampleCustomers);

    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Created ${groceryProducts.length} grocery products`);
    console.log(`🍽️ Created ${restaurantProducts.length} restaurant items`);
    console.log(`🪑 Created ${restaurantTables.length} restaurant tables`);
    console.log(`👥 Created ${sampleCustomers.length} customers`);
    console.log(`🏪 Created 2 business units`);
    console.log(`👤 Created 1 admin staff member`);

  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
