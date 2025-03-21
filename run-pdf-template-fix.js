/**
 * Run PDF Template Fix
 * 
 * This script runs the PDF template settings fix
 */

const { analyzeAndFixPdfTemplateIssues } = require('./fix-pdf-template-settings');

console.log('Starting PDF template settings fix...');

analyzeAndFixPdfTemplateIssues()
  .then(result => {
    console.log('PDF template settings fixed successfully!');
    console.log('Updated settings ID:', result.id);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running PDF template fix:', error);
    process.exit(1);
  });