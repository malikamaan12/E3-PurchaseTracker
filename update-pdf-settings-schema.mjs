// Simplified script using directly executed SQL in ES modules format
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function updatePdfSettingsSchema() {
  console.log('Starting PDF settings schema update...');
  
  try {
    // Check if the columns already exist
    const columnCheckQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings'
        AND (column_name = 'header_height' OR column_name = 'footer_height');
    `;
    
    const columnCheck = await db.execute(columnCheckQuery);
    console.log('Current columns:', columnCheck);
    
    const columnsToAdd = [];
    
    if (!columnCheck.some(col => col.column_name === 'header_height')) {
      columnsToAdd.push('ADD COLUMN header_height INTEGER NOT NULL DEFAULT 100');
    }
    
    if (!columnCheck.some(col => col.column_name === 'footer_height')) {
      columnsToAdd.push('ADD COLUMN footer_height INTEGER NOT NULL DEFAULT 50');
    }
    
    if (columnsToAdd.length > 0) {
      console.log('Adding missing columns to pdf_settings table:', columnsToAdd);
      
      const alterQuery = sql`
        ALTER TABLE pdf_settings
        ${sql.raw(columnsToAdd.join(', '))};
      `;
      
      await db.execute(alterQuery);
      
      console.log('PDF settings schema updated successfully!');
    } else {
      console.log('All required columns already exist in pdf_settings table.');
    }

    // Verify the update worked
    const verifyQuery = sql`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings';
    `;
    const updatedColumns = await db.execute(verifyQuery);
    console.log('Updated table schema:', updatedColumns);
    
  } catch (error) {
    console.error('Error updating PDF settings schema:', error);
    throw error;
  }
}

// Run the script
updatePdfSettingsSchema()
  .then(() => {
    console.log('Schema update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update schema:', error);
    process.exit(1);
  });