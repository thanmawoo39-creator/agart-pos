import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Restoring database from stable backup...');

// Step 1: Restore database from Jan 8th backup
const sourcePath = path.join(__dirname, 'backups', 'POS_Startup_Backup_2026-01-08T12-38-08-928Z.db');
const targetPath = path.join(__dirname, 'sqlite.db');

try {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('✅ Database restored successfully from Jan 8th backup');
  } else {
    console.error('❌ Source backup file not found:', sourcePath);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error restoring database:', error.message);
  process.exit(1);
}

// Step 2: Clean up any existing database files
const filesToClean = ['database.sqlite'];
filesToClean.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up: ${file}`);
    } catch (error) {
      console.log(`ℹ️  Could not clean up ${file}: ${error.message}`);
    }
  }
});

console.log('🎯 Database restoration complete!');
console.log('📋 Next steps:');
console.log('   1. Revert auth.ts to 4-digit PIN');
console.log('   2. Revert Login UI to 4-digit PIN');
console.log('   3. Delete migrations folder');
console.log('   4. Run: npx drizzle-kit generate');
console.log('   5. Run: npx drizzle-kit push --force');
