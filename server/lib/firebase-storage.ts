import admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;
let storage: Storage | null = null;

function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Check if we have all required Firebase credentials
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!projectId || !clientEmail || !privateKey || !storageBucket) {
      console.warn('Firebase credentials not fully configured. Using local storage fallback.');
      console.warn('Project ID:', !!projectId);
      console.warn('Client Email:', !!clientEmail);
      console.warn('Private Key:', !!privateKey);
      console.warn('Storage Bucket:', !!storageBucket);
      return null;
    }

    // Debug: Log the private key format (first 50 chars)
    console.log('Private key preview:', privateKey.substring(0, 50) + '...');
    console.log('Private key length:', privateKey.length);
    console.log('Contains \\n:', privateKey.includes('\\\\n'));
    console.log('Contains actual \\n:', privateKey.includes('\\n'));

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      storageBucket,
    });

    // Initialize Google Cloud Storage
    storage = new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });

    console.log('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export async function uploadToFirebaseStorage(
  buffer: Buffer,
  filename: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const app = initializeFirebase();
    if (!app || !storage) {
      console.warn('Firebase not initialized, falling back to local storage');
      return null;
    }

    const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET!);
    const file = bucket.file(`receipts/${filename}`);

    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType,
      },
    });

    // Make the file publicly readable
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/receipts/${filename}`;
    
    console.log('File uploaded to Firebase Storage:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Firebase Storage:', error);
    return null;
  }
}

export async function deleteFromFirebaseStorage(filename: string): Promise<boolean> {
  try {
    const app = initializeFirebase();
    if (!app || !storage) {
      return false;
    }

    const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET!);
    const file = bucket.file(`receipts/${filename}`);
    
    await file.delete();
    console.log('File deleted from Firebase Storage:', filename);
    return true;
  } catch (error) {
    console.error('Error deleting from Firebase Storage:', error);
    return false;
  }
}

// Fallback local storage functions
export async function uploadToLocalStorage(
  buffer: Buffer,
  filename: string
): Promise<string | null> {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);

    // Return the URL
    const imageUrl = `/uploads/${filename}`;
    console.log('File uploaded to local storage:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading to local storage:', error);
    return null;
  }
}
