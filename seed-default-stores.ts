import { storage } from './server/storage';
import { randomUUID } from 'crypto';

async function seedDefaultStores() {
  try {
    console.log('🌱 Seeding default stores...');
    
    // Check if stores already exist
    const existingStores = await storage.getBusinessUnits();
    console.log(`Found ${existingStores.length} existing stores`);
    
    if (existingStores.length === 0) {
      // Create default stores with hardcoded IDs
      const mainStore = {
        id: '1', // Hardcoded ID for Main Store
        name: 'Main Store',
        type: 'Grocery' as const,
        settings: JSON.stringify({ location: '123 Main Street', phone: '+1 234 567 8900' }),
        isActive: 'true' as const
      };

      const restaurant = {
        id: '2', // Hardcoded ID for Restaurant
        name: 'Restaurant',
        type: 'Restaurant' as const,
        settings: JSON.stringify({ location: '456 Food Avenue', phone: '+1 234 567 8901' }),
        isActive: 'true' as const
      };

      // Insert stores
      const createdMainStore = await storage.createBusinessUnit(mainStore);
      const createdRestaurant = await storage.createBusinessUnit(restaurant);
      
      console.log('✅ Created default stores:');
      console.log(`   - ${createdMainStore.name} (${createdMainStore.type})`);
      console.log(`   - ${createdRestaurant.name} (${createdRestaurant.type})`);
      
      // Create sample products for Main Store (Grocery)
      await seedGroceryData(createdMainStore.id);
      
      // Create sample products for Restaurant
      await seedRestaurantData(createdRestaurant.id);
      
    } else {
      console.log('📦 Stores already exist, skipping seed');
    }
    
  } catch (error) {
    console.error('❌ Failed to seed default stores:', error);
  }
}

async function seedGroceryData(storeId: string) {
  try {
    console.log(`🛒 Seeding grocery data for store ${storeId}`);
    
    // Create products
    const products = [
      { 
        name: 'Fresh Apples', 
        price: 2.99, 
        stock: 50, 
        category: 'Fruits & Vegetables', 
        businessUnitId: storeId, 
        barcode: '1234567890',
        cost: 1.50,
        minStockLevel: 10,
        unit: 'kg',
        status: 'active'
      },
      { 
        name: 'Milk 1L', 
        price: 3.49, 
        stock: 30, 
        category: 'Dairy Products', 
        businessUnitId: storeId, 
        barcode: '1234567891',
        cost: 2.00,
        minStockLevel: 5,
        unit: 'liter',
        status: 'active'
      },
      { 
        name: 'Bread', 
        price: 2.99, 
        stock: 25, 
        category: 'Bakery Items', 
        businessUnitId: storeId, 
        barcode: '1234567892',
        cost: 1.20,
        minStockLevel: 8,
        unit: 'loaf',
        status: 'active'
      },
      { 
        name: 'Orange Juice', 
        price: 4.99, 
        stock: 20, 
        category: 'Beverages', 
        businessUnitId: storeId, 
        barcode: '1234567893',
        cost: 3.00,
        minStockLevel: 6,
        unit: 'liter',
        status: 'active'
      }
    ];

    for (const product of products) {
      await storage.createProduct(product);
    }
    
    console.log('✅ Grocery data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed grocery data:', error);
  }
}

async function seedRestaurantData(storeId: string) {
  try {
    console.log(`🍽️ Seeding restaurant data for store ${storeId}`);
    
    // Create menu items
    const products = [
      { 
        name: 'Caesar Salad', 
        price: 8.99, 
        stock: 100, 
        category: 'Appetizers', 
        businessUnitId: storeId, 
        barcode: '9876543210',
        cost: 4.50,
        minStockLevel: 0,
        unit: 'portion',
        status: 'active'
      },
      { 
        name: 'Grilled Chicken', 
        price: 15.99, 
        stock: 100, 
        category: 'Main Courses', 
        businessUnitId: storeId, 
        barcode: '9876543211',
        cost: 8.00,
        minStockLevel: 0,
        unit: 'portion',
        status: 'active'
      },
      { 
        name: 'Chocolate Cake', 
        price: 6.99, 
        stock: 100, 
        category: 'Desserts', 
        businessUnitId: storeId, 
        barcode: '9876543212',
        cost: 3.50,
        minStockLevel: 0,
        unit: 'slice',
        status: 'active'
      },
      { 
        name: 'Coffee', 
        price: 3.99, 
        stock: 100, 
        category: 'Beverages', 
        businessUnitId: storeId, 
        barcode: '9876543213',
        cost: 1.00,
        minStockLevel: 0,
        unit: 'cup',
        status: 'active'
      }
    ];

    for (const product of products) {
      await storage.createProduct(product);
    }
    
    console.log('✅ Restaurant data seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed restaurant data:', error);
  }
}

// Run the seed function
seedDefaultStores().then(() => {
  console.log('🎉 Seeding completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Seeding failed:', error);
  process.exit(1);
});
