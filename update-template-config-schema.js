// Update the PDF settings schema to add templateConfig field
import { db } from './db/index';
import * as schema from './db/schema';

async function updatePdfTemplateConfigSchema() {
  console.log('Updating PDF settings schema to add templateConfig field...');
  
  try {
    // Check if the column already exists
    const result = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pdf_settings' AND column_name = 'template_config'
    `);
    
    if (result.rows.length === 0) {
      // Add the templateConfig column if it doesn't exist
      await db.execute(`
        ALTER TABLE pdf_settings 
        ADD COLUMN IF NOT EXISTS template_config text
      `);
      console.log('Added template_config column to pdf_settings table');
    } else {
      console.log('template_config column already exists');
    }

    // Check if user_id column exists
    const userIdResult = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'user_id'
    `);
    
    if (userIdResult.rows.length === 0) {
      // Add the user_id column to audit_logs if it doesn't exist
      await db.execute(`
        ALTER TABLE audit_logs 
        ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id)
      `);
      console.log('Added user_id column to audit_logs table');
    } else {
      console.log('user_id column already exists in audit_logs');
    }

    // Create a default PDF settings record if none exists
    const defaultSettings = {
      headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
      headerSubtitle: 'PURCHASE REQUEST',
      headerColor: '#6F2AE6', // Purple
      footerText: 'CONFIDENTIAL - ALL RIGHTS RESERVED',
      footerColor: '#6F2AE6',
      pageNumbering: true,
      watermarkOpacity: 10,
      templateConfig: JSON.stringify({
        name: 'Standard Template',
        type: 'standard',
        layout: 'portrait',
        showHeader: true,
        showFooter: true,
        showLogo: true,
        showWatermark: true,
        securityLevel: 'internal',
        headerColor: [111, 42, 230],
        accentColor: [31, 211, 219],
        watermarkOpacity: 0.08,
        watermarkText: 'INTERNAL USE',
        showApprovalFlow: true,
        showSignatureLines: true,
        showAttachments: true,
        showTotalsTable: true
      })
    };

    // Check if a record exists
    const settingsExist = await db.select().from(schema.pdfSettings).limit(1);
    
    if (settingsExist.length === 0) {
      // Insert default settings if no record exists
      await db.insert(schema.pdfSettings).values(defaultSettings);
      console.log('Created default PDF settings');
    }

    console.log('PDF settings schema update completed successfully');
  } catch (error) {
    console.error('Error updating PDF settings schema:', error);
  }
}

// Run the update function
updatePdfTemplateConfigSchema().then(() => {
  console.log('Schema update completed');
  process.exit(0);
}).catch(err => {
  console.error('Schema update failed:', err);
  process.exit(1);
});