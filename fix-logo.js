import fs from 'fs';
import { Client } from 'pg';

async function fixLogo() {
  // Read the complete logo data
  const logoData = fs.readFileSync('complete-logo-data.txt', 'utf8').trim();
  
  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Insert the complete logo data
    const query = `
      INSERT INTO pdf_settings (
        id, user_id, login_logo, header_title, header_subtitle, header_color, 
        footer_text, footer_color, font_family, font_size, margin_top, margin_bottom,
        margin_left, margin_right, watermark_text, watermark_opacity, 
        show_basic_info, show_requester_details, show_date_of_request, show_purpose_info,
        show_vendor_details, show_items, show_approvals, show_attachments, show_audit_info,
        show_signatures, page_numbering, company_address, company_phone, company_email,
        company_website, created_at, updated_at
      ) VALUES (
        142, 1, $1, 'E3 Purchase Request', 'Purchase Management System', '#4f46e5',
        'E3 Purchase Management System', '#000000', 'Arial', 12, 40, 40,
        40, 40, 'CONFIDENTIAL', 0.1,
        true, true, true, true, true, true, true, true, true, true, true,
        'E3 Company Address', '123-456-7890', 'info@e3.com', 'www.e3.com',
        NOW(), NOW()
      )
    `;
    
    await client.query(query, [logoData]);
    console.log('Logo data inserted successfully');
    
    // Verify the insertion
    const result = await client.query('SELECT LENGTH(login_logo) as logo_length FROM pdf_settings WHERE id = 142');
    console.log('Logo length in database:', result.rows[0].logo_length);
    
  } catch (error) {
    console.error('Error inserting logo:', error);
  } finally {
    await client.end();
  }
}

fixLogo();