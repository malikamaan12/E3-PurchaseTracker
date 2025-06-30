#!/usr/bin/env node

/**
 * Database Migration Helper for DigitalOcean Setup
 * 
 * This script helps migrate data between Replit/Neon and DigitalOcean databases
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const BACKUP_FILE = 'database-backup.sql';

function logStep(message) {
  console.log(`\n📋 ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.error(`❌ ${message}`);
}

// Export current Replit/Neon database
function exportDatabase() {
  logStep('Exporting current database...');
  
  const currentDbUrl = process.env.DATABASE_URL;
  if (!currentDbUrl) {
    logError('DATABASE_URL not found. Make sure you\'re running this in Replit.');
    process.exit(1);
  }
  
  try {
    // Use pg_dump for Neon database
    execSync(`pg_dump "${currentDbUrl}" > ${BACKUP_FILE}`, { stdio: 'inherit' });
    logSuccess(`Database exported to ${BACKUP_FILE}`);
  } catch (error) {
    logError('Failed to export database');
    console.error(error.message);
    process.exit(1);
  }
}

// Import to DigitalOcean database
function importDatabase() {
  logStep('Importing to DigitalOcean database...');
  
  const prodDbUrl = process.env.PROD_DATABASE_URL;
  if (!prodDbUrl) {
    logError('PROD_DATABASE_URL not found. Please set it in Replit Secrets.');
    console.log('Format: postgresql://doadmin:password@host:25060/database?sslmode=require');
    process.exit(1);
  }
  
  if (!fs.existsSync(BACKUP_FILE)) {
    logError(`Backup file ${BACKUP_FILE} not found. Run export first.`);
    process.exit(1);
  }
  
  try {
    execSync(`psql "${prodDbUrl}" < ${BACKUP_FILE}`, { stdio: 'inherit' });
    logSuccess('Database imported to DigitalOcean successfully!');
  } catch (error) {
    logError('Failed to import database');
    console.error(error.message);
    process.exit(1);
  }
}

// Test DigitalOcean connection
function testConnection() {
  logStep('Testing DigitalOcean database connection...');
  
  const prodDbUrl = process.env.PROD_DATABASE_URL;
  if (!prodDbUrl) {
    logError('PROD_DATABASE_URL not found.');
    process.exit(1);
  }
  
  try {
    execSync(`psql "${prodDbUrl}" -c "SELECT version();"`, { stdio: 'inherit' });
    logSuccess('DigitalOcean database connection successful!');
  } catch (error) {
    logError('Failed to connect to DigitalOcean database');
    console.error(error.message);
    process.exit(1);
  }
}

// Clean up backup file
function cleanup() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.unlinkSync(BACKUP_FILE);
    logSuccess('Cleanup completed');
  }
}

// Main command handling
const command = process.argv[2];

switch (command) {
  case 'export':
    exportDatabase();
    break;
  case 'import':
    importDatabase();
    break;
  case 'test':
    testConnection();
    break;
  case 'migrate':
    exportDatabase();
    importDatabase();
    cleanup();
    logSuccess('Migration completed! Your app is now using DigitalOcean database.');
    break;
  case 'cleanup':
    cleanup();
    break;
  default:
    console.log(`
🚀 Database Migration Helper

Usage:
  node database-migration.js [command]

Commands:
  export   - Export current Replit/Neon database to backup file
  import   - Import backup file to DigitalOcean database  
  test     - Test DigitalOcean database connection
  migrate  - Full migration (export + import + cleanup)
  cleanup  - Remove backup files

Setup Steps:
1. Create DigitalOcean PostgreSQL database
2. Add PROD_DATABASE_URL to Replit Secrets
3. Run: node database-migration.js migrate

Example PROD_DATABASE_URL:
postgresql://doadmin:password@host-name.db.ondigitalocean.com:25060/purchase_management?sslmode=require

Note: Your app will automatically use PROD_DATABASE_URL when available,
falling back to DATABASE_URL for development.
    `);
}