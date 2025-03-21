/**
 * Enhanced PDF Settings Schema Migration
 * 
 * This script adds new columns to the pdf_settings table to support advanced
 * customization features for PDF generation and export.
 */

import { db } from './db/index.js';
import { sql } from 'drizzle-orm/sql';
import { pdfSettings } from './db/schema.js';

async function updateEnhancedPdfSettingsSchema() {
  console.log('Starting Enhanced PDF Settings schema update...');
  
  try {
    // Check existing columns
    const columnsQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings';
    `;
    
    const existingColumns = await db.execute(columnsQuery);
    const columnNames = existingColumns.map(col => col.column_name);
    console.log('Current pdf_settings columns:', columnNames);
    
    // Define new columns
    const newColumns = [
      { name: 'watermark_text', type: 'TEXT', default: "'CONFIDENTIAL'" },
      { name: 'font_family', type: 'TEXT', default: "'helvetica'" },
      { name: 'logo_position', type: 'TEXT', default: "'left'" },
      { name: 'company_address', type: 'TEXT', default: 'NULL' },
      { name: 'company_phone', type: 'TEXT', default: 'NULL' },
      { name: 'company_email', type: 'TEXT', default: 'NULL' },
      { name: 'company_website', type: 'TEXT', default: 'NULL' },
      { name: 'show_basic_info', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_requester_details', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_date_of_request', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_purpose_info', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_vendor_details', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_items', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_approvals', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_attachments', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'show_audit_info', type: 'BOOLEAN', default: 'FALSE' },
      { name: 'show_signatures', type: 'BOOLEAN', default: 'TRUE' }
    ];
    
    // Add columns that don't exist yet
    const columnsToAdd = newColumns.filter(col => !columnNames.includes(col.name));
    
    if (columnsToAdd.length > 0) {
      console.log('Adding new columns to pdf_settings table:', columnsToAdd.map(c => c.name));
      
      for (const column of columnsToAdd) {
        const alterQuery = sql`
          ALTER TABLE pdf_settings
          ADD COLUMN IF NOT EXISTS ${sql.raw(column.name)} ${sql.raw(column.type)} DEFAULT ${sql.raw(column.default)};
        `;
        
        await db.execute(alterQuery);
        console.log(`Added column: ${column.name}`);
      }
      
      console.log('PDF settings schema update completed successfully!');
    } else {
      console.log('All required columns already exist in pdf_settings table.');
    }
    
    // Verify the schema update
    const updatedColumnsQuery = sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns
      WHERE table_name = 'pdf_settings'
      ORDER BY ordinal_position;
    `;
    
    const updatedColumns = await db.execute(updatedColumnsQuery);
    console.log('Updated pdf_settings schema:', updatedColumns.map(col => `${col.column_name} (${col.data_type})`));
    
    // Create default PDF settings if none exist
    const settingsExist = await db.select().from(sql`pdf_settings`).limit(1);
    
    if (settingsExist.length === 0) {
      console.log('No PDF settings found, creating default settings...');
      
      const defaultTemplateConfig = JSON.stringify({
        name: 'Standard PR Template',
        type: 'purchase_request',
        layout: 'standard',
        showHeader: true,
        showFooter: true,
        showLogo: true,
        showWatermark: true,
        securityLevel: 'internal',
        headerColor: [0, 112, 192],
        accentColor: [79, 70, 229],
        watermarkOpacity: 0.1,
        watermarkText: 'CONFIDENTIAL',
        showApprovalFlow: true,
        showSignatureLines: true,
        showAttachments: true,
        showTotalsTable: true,
        customFields: {
          showRequesterId: true,
          showRequesterDepartment: true,
          showPurposeType: true,
          showSubmissionDate: true
        }
      });
      
      const insertQuery = sql`
        INSERT INTO pdf_settings (
          header_title, header_subtitle, header_color, footer_text, footer_color,
          page_numbering, watermark_opacity, watermark_text, template_config
        ) VALUES (
          'Purchase Request', 'Events & Entertainment Enterprises', '#0070c0',
          '© 2025 - Confidential', '#333333', TRUE, 10, 'CONFIDENTIAL',
          ${defaultTemplateConfig}
        );
      `;
      
      await db.execute(insertQuery);
      console.log('Created default PDF settings record');
    }
    
    return { success: true, message: 'PDF settings schema updated successfully' };
  } catch (error) {
    console.error('Error updating PDF settings schema:', error);
    return { success: false, error: error.message };
  }
}

// Run the script
updateEnhancedPdfSettingsSchema()
  .then((result) => {
    console.log('Schema update result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Failed to update schema:', error);
    process.exit(1);
  });