import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔄 Starting complete PIN reset process...');

// Step 1: Kill all Node processes
try {
  console.log('📱 Killing all Node processes...');
  execSync('taskkill /F /IM node.exe', { stdio: 'inherit' });
} catch (error) {
  console.log('ℹ️ No Node processes to kill or command failed');
}

// Step 2: Wait a moment for processes to fully terminate
await new Promise(resolve => setTimeout(resolve, 2000));

// Step 3: Delete database file
const dbPath = path.join(process.cwd(), 'database.sqlite');
try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Database file deleted successfully');
  } else {
    console.log('ℹ️ Database file does not exist');
  }
} catch (error) {
  console.error('❌ Error deleting database:', error.message);
}

// Step 4: Delete any other database files
const otherDbFiles = ['sqlite.db', 'database.sqlite'];
for (const file of otherDbFiles) {
  const filePath = path.join(process.cwd(), file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted ${file}`);
    }
  } catch (error) {
    console.log(`ℹ️ Could not delete ${file}: ${error.message}`);
  }
}

console.log('🎯 Reset complete. Ready for fresh database setup.');
