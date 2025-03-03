// This script updates the PDF settings table schema to add missing watermark_opacity column
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function updatePdfSettingsSchema() {
  try {
    console.log('Creating migration SQL file for watermark_opacity column...');
    
    // Create a temporary SQL file
    const migrationSQL = `
-- Add watermark_opacity column to pdf_settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pdf_settings'
        AND column_name = 'watermark_opacity'
    ) THEN
        ALTER TABLE pdf_settings
        ADD COLUMN watermark_opacity integer NOT NULL DEFAULT 10;
    END IF;
END
$$;
`;
    
    // Write the SQL to a temporary file
    await fs.promises.writeFile('add-watermark-opacity.sql', migrationSQL);
    
    // Get the DATABASE_URL from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Execute the SQL using the psql command
    console.log('Executing SQL migration...');
    const { stdout, stderr } = await execPromise(`psql "${dbUrl}" -f add-watermark-opacity.sql`);
    
    console.log('Migration output:', stdout);
    if (stderr) {
      console.error('Migration errors:', stderr);
    }
    
    // Verify the column was added
    const { stdout: verifyOutput } = await execPromise(
      `psql "${dbUrl}" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'pdf_settings'"`
    );
    
    console.log('Current pdf_settings table columns:');
    console.log(verifyOutput);
    
    console.log('Schema update completed successfully');
    
    // Clean up the temporary file
    await fs.promises.unlink('add-watermark-opacity.sql');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    process.exit(0);
  }
}

// Run the update function
updatePdfSettingsSchema();