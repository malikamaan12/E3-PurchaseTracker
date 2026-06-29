import { complianceService } from './src/lib/services/ComplianceService';
complianceService.scanVendorDocuments(1).then(console.log).catch(console.error);
