/**
 * Update Purchase Requests Schema - Add additionalApprovers Field
 * 
 * This script adds the additionalApprovers column to the purchase_requests table.
 */

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/pg-server';
import { sql } from 'drizzle-orm';

async function updatePurchaseRequestsSchema() {
  // Connect to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  const db = drizzle(pool);
  
  try {
    console.log('Starting schema update...');
    
    // Check if additional_approvers column already exists
    const { rows: columns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'purchase_requests' AND column_name = 'additional_approvers';
    `);
    
    if (columns.length > 0) {
      console.log('Column additional_approvers already exists, skipping creation.');
    } else {
      // Add additional_approvers column
      console.log('Adding additional_approvers column to purchase_requests table...');
      await pool.query(`
        ALTER TABLE purchase_requests 
        ADD COLUMN additional_approvers TEXT;
      `);
      console.log('Successfully added additional_approvers column.');
    }
    
    console.log('Schema update completed successfully.');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updatePurchaseRequestsSchema();