import { db } from '../lib/db';
import { products } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function cleanAppleImage() {
  console.log('Starting script to clean apple image URL...');

  try {
    // Find all products named 'Apples'
    const appleProducts = await db.select().from(products).where(eq(products.name, 'Apples'));

    for (const product of appleProducts) {
      if (product.imageUrl !== 'apples.jpg') {
        console.log(`Updating 'Apples' imageUrl from '${product.imageUrl}' to 'apples.jpg'`);
        await db.update(products)
          .set({ imageUrl: 'apples.jpg' })
          .where(eq(products.id, product.id));
        console.log("Successfully cleaned 'Apples' product image URL.");
      } else {
        console.log("'Apples' product image URL is already clean.");
      }
    }

  } catch (error) {
    console.error('An error occurred during the script:', error);
  }
}

cleanAppleImage();
