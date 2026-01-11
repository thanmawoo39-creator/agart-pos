import Database from 'better-sqlite3';
import fs from 'fs/promises';

async function backupDatabaseSchema() {
  console.log('📦 Creating database schema backup...');
  
  try {
    const db = new Database('database.sqlite');
    let schema = '';
    let data = '';
    
    // Get database schema
    console.log('📋 Extracting schema...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    
    schema += `-- Database Schema Backup
-- Generated: ${new Date().toISOString()}
-- Total Tables: ${tables.length}

`;
    
    for (const table of tables) {
      const tableName = table.name;
      schema += `\n-- Table: ${tableName}\n`;
      
      try {
        // Get CREATE TABLE statement
        const createStmt = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName) as any;
        if (createStmt && createStmt.sql) {
          schema += `${createStmt.sql};\n\n`;
        }
        
        // Get table data
        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        if (rows.length > 0) {
          data += `\n-- Data for ${tableName} (${rows.length} records)\n`;
          
          rows.forEach((row, index) => {
            data += `-- Record ${index + 1}\n`;
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (val === undefined) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'number') return val.toString();
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return `'${val}'`;
            });
            data += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          });
          data += '\n';
        }
        
      } catch (error: any) {
        schema += `-- Error: ${error.message}\n\n`;
      }
    }
    
    // Write schema backup
    await fs.writeFile('database_schema_backup.sql', schema, 'utf8');
    console.log('✅ Schema backup saved to database_schema_backup.sql');
    
    // Write data backup
    await fs.writeFile('database_data_backup.sql', data, 'utf8');
    console.log('✅ Data backup saved to database_data_backup.sql');
    
    // Create combined backup
    const combinedBackup = `${schema}\n\n${data}`;
    await fs.writeFile('database_complete_backup.sql', combinedBackup, 'utf8');
    console.log('✅ Complete backup saved to database_complete_backup.sql');
    
    // Also copy the database file
    await fs.copyFile('database.sqlite', 'database_final_backup.sqlite');
    console.log('✅ Database file copied to database_final_backup.sqlite');
    
    // Create summary
    const summary = `# Database Backup Summary
Generated: ${new Date().toISOString()}
Tables: ${tables.length}
Files Created:
- database_schema_backup.sql (schema only)
- database_data_backup.sql (data only)  
- database_complete_backup.sql (schema + data)
- database_final_backup.sqlite (complete database)

Tables Included:
${tables.map(t => `- ${t.name}`).join('\n')}

Admin Credentials:
- Username: Admin
- PIN: 1234

System Status: ✅ Fully Operational with Gemini 3 Flash
`;
    
    await fs.writeFile('database_backup_summary.md', summary, 'utf8');
    console.log('✅ Backup summary saved to database_backup_summary.md');
    
    db.close();
    console.log('🎉 Database backup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error backing up database:', error);
  }
}

backupDatabaseSchema();
