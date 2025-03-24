/**
 * Update Company Info in PDF Settings
 * 
 * This script ensures there's only one PDF settings record in the database
 * and updates it with the correct company information.
 */

import { db } from './db/index.js';
import { pdfSettings, eq, desc } from './db/schema.js';

// Fix ESM import by making this file a module
// Add package.json type field if missing

async function updateCompanyInfo() {
  console.log('Starting company info update in PDF settings...');

  try {
    // Get all pdf settings records, ordered by most recently updated
    const allSettings = await db.query.pdfSettings.findMany({
      orderBy: [desc(pdfSettings.updatedAt)]
    });

    console.log(`Found ${allSettings.length} PDF settings records`);

    if (allSettings.length === 0) {
      console.log('No PDF settings found. Creating a new record...');
      
      // Create a new settings record with company info
      const [newSetting] = await db.insert(pdfSettings).values({
        headerTitle: 'EVENTS & ENTERTAINMENT ENTERPRISES',
        headerSubtitle: 'PURCHASE REQUEST',
        headerColor: '#1a365d',
        footerText: 'ALL RIGHTS RESERVED BY E3',
        footerColor: '#1a365d',
        pageNumbering: true,
        fontSize: 11,
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 25,
        marginRight: 25,
        headerHeight: 60,
        footerHeight: 40,
        // Company information
        companyAddress: 'Palm Tower B 36th Floor, 3602 West Bay, Doha, Qatar',
        companyPhone: '+974 30489955',
        companyEmail: 'info@eeeqa.com',
        companyWebsite: 'WWW.eeeeqa.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log('Created new PDF settings with company info:', newSetting);
      return;
    }

    // Keep the most recent record and update it with company info
    const mostRecentSetting = allSettings[0];
    console.log('Most recent setting ID:', mostRecentSetting.id);
    
    // Update with company information
    const [updatedSetting] = await db.update(pdfSettings)
      .set({
        companyAddress: 'Palm Tower B 36th Floor, 3602 West Bay, Doha, Qatar',
        companyPhone: '+974 30489955',
        companyEmail: 'info@eeeqa.com',
        companyWebsite: 'WWW.eeeeqa.com',
        updatedAt: new Date()
      })
      .where(eq(pdfSettings.id, mostRecentSetting.id))
      .returning();
    
    console.log('Updated company info in most recent PDF settings:', updatedSetting);
    
    // Delete all other records
    if (allSettings.length > 1) {
      const idsToDelete = allSettings
        .slice(1)
        .map(setting => setting.id);
      
      console.log(`Deleting ${idsToDelete.length} extra PDF settings records...`);
      
      for (const id of idsToDelete) {
        await db.delete(pdfSettings)
          .where(eq(pdfSettings.id, id));
      }
      
      console.log('Deleted extra PDF settings records');
    }
    
    console.log('Company info update complete!');
  } catch (error) {
    console.error('Error updating company info:', error);
  }
}

// Execute the update
updateCompanyInfo().catch(console.error);