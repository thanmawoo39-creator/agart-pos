import Database from 'better-sqlite3';
import fs from 'fs/promises';

async function exportDatabase() {
  console.log('📤 Exporting database data...');
  
  try {
    const db = new Database('database.sqlite');
    let output = '';
    
    // Get all table names
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    
    for (const table of tables) {
      const tableName = table.name;
      console.log(`📋 Exporting table: ${tableName}`);
      
      output += `\n========================================\n`;
      output += `TABLE: ${tableName.toUpperCase()}\n`;
      output += `========================================\n\n`;
      
      try {
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        
        if (rows.length === 0) {
          output += `No data in this table.\n\n`;
          continue;
        }
        
        // Get column names
        const columnNames = Object.keys(rows[0]);
        output += `Columns: ${columnNames.join(', ')}\n`;
        output += `Total Records: ${rows.length}\n\n`;
        
        // Export each record
        rows.forEach((row, index) => {
          output += `--- Record ${index + 1} ---\n`;
          columnNames.forEach(col => {
            const value = row[col];
            const displayValue = value === null ? 'NULL' : 
                              value === undefined ? 'UNDEFINED' :
                              typeof value === 'object' ? JSON.stringify(value) :
                              String(value);
            output += `${col}: ${displayValue}\n`;
          });
          output += '\n';
        });
        
      } catch (error: any) {
        output += `Error exporting table ${tableName}: ${error.message}\n\n`;
      }
    }
    
    // Write to file
    await fs.writeFile('data_summary.txt', output, 'utf8');
    console.log('✅ Database exported to data_summary.txt');
    
    // Also create a JSON version for easier import
    const jsonOutput: any = {};
    for (const table of tables) {
      try {
        const tableName = table.name;
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        jsonOutput[tableName] = rows;
      } catch (error) {
        console.log(`⚠️ Could not export table ${table.name}:`, error);
      }
    }
    
    await fs.writeFile('data_summary.json', JSON.stringify(jsonOutput, null, 2), 'utf8');
    console.log('✅ Database exported to data_summary.json');
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error exporting database:', error);
  }
}

exportDatabase();
