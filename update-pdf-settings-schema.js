import { connect } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

async function updatePdfSettingsSchema() {
  // Use the DATABASE_URL environment variable directly
  const client = connect({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(client);

  console.log('Connected to the database');
  
  try {
    // Check if the columns already exist to avoid errors
    const columnCheckQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings'
        AND (column_name = 'header_height' OR column_name = 'footer_height');
    `;
    
    const columnCheck = await db.execute(columnCheckQuery);
    
    const columnsToAdd = [];
    
    if (!columnCheck.some(col => col.column_name === 'header_height')) {
      columnsToAdd.push('ADD COLUMN header_height INTEGER NOT NULL DEFAULT 100');
    }
    
    if (!columnCheck.some(col => col.column_name === 'footer_height')) {
      columnsToAdd.push('ADD COLUMN footer_height INTEGER NOT NULL DEFAULT 50');
    }
    
    if (columnsToAdd.length > 0) {
      console.log('Adding missing columns to pdf_settings table...');
      
      const alterQuery = sql`
        ALTER TABLE pdf_settings
        ${sql.raw(columnsToAdd.join(', '))};
      `;
      
      await db.execute(alterQuery);
      
      console.log('PDF settings schema updated successfully!');
    } else {
      console.log('All required columns already exist in pdf_settings table.');
    }
  } catch (error) {
    console.error('Error updating PDF settings schema:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the script
updatePdfSettingsSchema()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update schema:', error);
    process.exit(1);
  });