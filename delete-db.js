import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');

try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Database file deleted successfully');
  } else {
    console.log('ℹ️ Database file does not exist');
  }
} catch (error) {
  console.error('❌ Error deleting database:', error);
}
