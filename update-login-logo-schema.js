const { db } = require('./db/index');
const { sql } = require('drizzle-orm');

async function updateLoginLogoSchema() {
  console.log('Starting PDF settings login logo schema update...');
  
  try {
    // Check if the column already exists
    const columnCheckQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings'
        AND column_name = 'login_logo';
    `;
    
    const columnCheck = await db.execute(columnCheckQuery);
    console.log('Current columns:', columnCheck);
    
    const columnsToAdd = [];
    
    if (!columnCheck.some(col => col.column_name === 'login_logo')) {
      columnsToAdd.push('ADD COLUMN login_logo TEXT');
      
      console.log('Adding login_logo column to pdf_settings table');
      
      const alterQuery = sql`
        ALTER TABLE pdf_settings
        ${sql.raw(columnsToAdd.join(', '))};
      `;
      
      await db.execute(alterQuery);
      
      console.log('PDF settings login logo schema updated successfully!');
    } else {
      console.log('login_logo column already exists in pdf_settings table.');
    }
    
    // Verify the update worked
    const verifyQuery = sql`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings'
        AND column_name = 'login_logo';
    `;
    const updatedColumns = await db.execute(verifyQuery);
    console.log('Updated table schema:', updatedColumns);
    
  } catch (error) {
    console.error('Error updating PDF settings schema:', error);
    throw error;
  }
}

// Run the script
updateLoginLogoSchema()
  .then(() => {
    console.log('Schema update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update schema:', error);
    process.exit(1);
  });