// This script updates the notifications table schema to add missing columns
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function updateNotificationsSchema() {
  try {
    console.log('Creating migration SQL file for notifications table...');
    
    // Create a temporary SQL file
    const migrationSQL = `
-- Add missing columns to notifications table
DO $$
BEGIN
    -- Add priority column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'priority'
    ) THEN
        ALTER TABLE notifications
        ADD COLUMN priority text NOT NULL DEFAULT 'normal';
    END IF;

    -- Add is_acknowledged column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'is_acknowledged'
    ) THEN
        ALTER TABLE notifications
        ADD COLUMN is_acknowledged boolean NOT NULL DEFAULT false;
    END IF;

    -- Add action_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'action_type'
    ) THEN
        ALTER TABLE notifications
        ADD COLUMN action_type text;
    END IF;

    -- Add action_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'action_data'
    ) THEN
        ALTER TABLE notifications
        ADD COLUMN action_data jsonb;
    END IF;

    -- Add expires_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE notifications
        ADD COLUMN expires_at timestamp;
    END IF;
END
$$;
`;
    
    // Write the SQL to a temporary file
    await fs.promises.writeFile('update-notifications.sql', migrationSQL);
    
    // Get the DATABASE_URL from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Execute the SQL using the psql command
    console.log('Executing SQL migration...');
    const { stdout, stderr } = await execPromise(`psql "${dbUrl}" -f update-notifications.sql`);
    
    console.log('Migration output:', stdout);
    if (stderr) {
      console.error('Migration errors:', stderr);
    }
    
    // Verify the columns were added
    const { stdout: verifyOutput } = await execPromise(
      `psql "${dbUrl}" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'"`
    );
    
    console.log('Current notifications table columns:');
    console.log(verifyOutput);
    
    console.log('Schema update completed successfully');
    
    // Clean up the temporary file
    await fs.promises.unlink('update-notifications.sql');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    process.exit(0);
  }
}

// Run the update function
updateNotificationsSchema();