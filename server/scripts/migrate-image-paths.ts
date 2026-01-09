import path from 'path';
import { db } from '../lib/db';
import { products } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function migrateImagePaths() {
  console.log('Starting image path migration...');

  try {
    const allProducts = await db.select().from(products);
    let updatedCount = 0;

    for (const product of allProducts) {
      if (product.imageUrl && (product.imageUrl.includes('/') || product.imageUrl.includes('\\'))) {
        const filename = path.basename(product.imageUrl);
        if (filename !== product.imageUrl) {
          console.log(`Updating product '${product.name}': '${product.imageUrl}' -> '${filename}'`);
          await db.update(products)
            .set({ imageUrl: filename })
            .where(eq(products.id, product.id));
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      console.log(`Successfully migrated ${updatedCount} product image paths.`);
    } else {
      console.log('No product image paths needed migration.');
    }

  } catch (error) {
    console.error('An error occurred during image path migration:', error);
  } finally {
    console.log('Migration script finished.');
  }
}

migrateImagePaths();
