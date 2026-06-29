import { complianceService } from './src/lib/services/ComplianceService';
complianceService.scanVendorDocuments(13).then(console.log).catch(console.error);
