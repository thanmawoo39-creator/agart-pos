# Firebase Storage Setup Guide

This application now supports Firebase Storage for receipt image uploads with automatic fallback to local storage.

## Option 1: Use Firebase Storage (Recommended for Production)

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enable Cloud Storage for your project

### 2. Get Service Account Credentials
1. In Firebase Console, go to Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file

### 3. Update Environment Variables
Update your `.env` file with the Firebase credentials:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

**Note:** The private key should be on one line with \n for line breaks.

### 4. Install Firebase Dependencies (Already done)
```bash
npm install firebase-admin @google-cloud/storage
```

### 5. Configure Storage Rules
In Firebase Console → Storage → Rules, set:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /receipts/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Option 2: Use Local Storage (Default)

If Firebase is not configured, the system will automatically fall back to local storage:
- Images are saved to the `uploads/` directory
- URLs are served as `http://localhost:5000/uploads/filename.jpg`
- No additional configuration required

## How It Works

1. **Upload Process**:
   - Try Firebase Storage first (if configured)
   - Fallback to local storage if Firebase fails
   - Return the public URL in both cases

2. **Frontend Integration**:
   - Camera capture or gallery upload
   - Image uploaded to backend
   - URL saved in `receiptImageUrl` field
   - Eye icon appears in expense table

3. **Viewing Receipts**:
   - Click "View" button in expense table
   - Opens image in new tab
   - Works with both Firebase and local URLs

## Testing

1. Start the server: `npm run dev`
2. Go to Expenses page
3. Click "Add Expense"
4. Click "Take Receipt Photo" or "Upload from Gallery"
5. After adding expense, check the table for "View" button
6. Click "View" to open the receipt image

## Troubleshooting

- **Firebase Upload Fails**: Check credentials in .env file
- **Local Storage Issues**: Ensure uploads directory has write permissions
- **Images Not Showing**: Check browser console for 404 errors
