import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

/**
 * CLEAN SLATE SEEDING SCRIPT
 * Populates E3 PurchaseTracker with realistic organizational data (Adil, Indika, etc.)
 */
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('🌱 [E3 Hub] Initializing Clean Slate Seed...');

  const defaultPassword = await bcrypt.hash('Password123!', 10);

  // 1. CLEAR EXISTING DATA (Reverse FK order)
  console.log('🧹 Clearing old test data...');
  await db.delete(schema.paymentVariations);
  await db.delete(schema.paymentInstallments);
  await db.delete(schema.fileAttachments);
  await db.delete(schema.approvals);
  await db.delete(schema.purchaseRequests);
  await db.delete(schema.auditLogs);
  await db.delete(schema.pdfSettings);
  await db.delete(schema.systemSettings);
  await db.delete(schema.notificationPreferences);
  await db.delete(schema.notifications);
  await db.delete(schema.errorLogs);
  await db.delete(schema.vendorPerformance);
  await db.delete(schema.vendorToCategories);
  await db.delete(schema.subPurposeBudgets);
  await db.delete(schema.subPurposes);
  await db.delete(schema.purposeCategories);
  await db.delete(schema.users);
  await db.delete(schema.departments);
  await db.delete(schema.vendors);
  await db.delete(schema.vendorCategories);

  // 2. INSERT MOCK VENDOR (Mandatory for PRs)
  console.log('🏢 Creating Global Test Vendor...');
  const [testVendor] = await db.insert(schema.vendors).values({
    companyName: 'Global Procurement Solutions',
    contactPerson: 'Saleem Khan',
    contactNumber: '+974 5555 1234',
    email: 'sales@globalprocure.com',
    address: 'Doha Festival City, Qatar',
    bankName: 'Qatar National Bank (QNB)',
    accountNumber: 'QNB-8822-1100',
    ibanNumber: 'QA99QNB0000000012345678',
    branchName: 'Main Branch',
    category: 'General',
    status: 'active'
  }).returning();

  // 3. INSERT DEPARTMENTS
  console.log('🏛️ Mapping 13 E3 Departments...');
  const departmentsData = [
    { name: 'CEO Office', isApprover: true },
    { name: 'Management', isApprover: true },
    { name: 'Finance', isApprover: true },
    { name: 'IT', isApprover: false },
    { name: 'Marketing', isApprover: false },
    { name: 'Events', isApprover: false },
    { name: 'Business Development', isApprover: false },
    { name: 'HR', isApprover: false },
    { name: 'Branding', isApprover: false },
    { name: 'Logistics', isApprover: false },
    { name: 'Production', isApprover: false },
    { name: 'Operations', isApprover: false },
    { name: 'F&B', isApprover: false }
  ];
  
  const insertedDepts = await db.insert(schema.departments).values(departmentsData).returning();
  const getDeptId = (name: string) => insertedDepts.find(d => d.name === name)!.id;

  // 4. INSERT USERS (Mapping Roles to System Permissions)
  console.log('👤 Creating E3 Staff Profiles...');
  const usersToInsert = [
    { name: 'Adil Ahmed', role: 'admin', department: 'CEO Office' }, // Mapping CEO -> Admin for sign-off
    { name: 'Mohammad Ali Awada', role: 'admin', department: 'Management' }, // Mapping GM -> Admin
    { name: 'Indika Manendra', role: 'admin', department: 'Finance' }, // Mapping Finance Head -> Admin
    { name: 'Abdullah', role: 'approver', department: 'Finance' }, // Accountant -> Approver
    { name: 'Rajan Pathak', role: 'approver', department: 'IT' }, // Manager -> Approver
    { name: 'Izan Sahid', role: 'user', department: 'IT' }, // Support -> User
    { name: 'Ahmad Faraz', role: 'approver', department: 'Marketing' },
    { name: 'Nicole Berindo', role: 'user', department: 'Marketing' },
    { name: 'Ebrahim Karolia', role: 'approver', department: 'Events' },
    { name: 'Hussain Abbas', role: 'approver', department: 'Business Development' },
    { name: 'Suhail Chatman', role: 'user', department: 'Business Development' },
    { name: 'Love Joy', role: 'approver', department: 'HR' },
    { name: 'Amaan Malik', role: 'user', department: 'Branding' },
    { name: 'Qusain Ali', role: 'user', department: 'Logistics' },
    { name: 'Arsalan Arshad', role: 'user', department: 'Logistics' },
    { name: 'Amal', role: 'user', department: 'Production' },
    { name: 'Lucian', role: 'user', department: 'Operations' },
    { name: 'Ruben', role: 'user', department: 'F&B' }
  ].map(u => ({
    username: u.name.split(' ')[0].toLowerCase(),
    email: `${u.name.replace(/\s+/g, '.').toLowerCase()}@e3.com`,
    password: defaultPassword,
    contact_number: '+974 0000 0000',
    department: u.department,
    role: u.role,
    isActive: true
  }));

  const insertedUsers = await db.insert(schema.users).values(usersToInsert).returning();
  const getUserId = (username: string) => insertedUsers.find(u => u.username === username)!.id;

  // 5. CREATE CATEGORIES & PROJECTS
  console.log('🔖 Creating Strategic Purpose Categories...');
  const [stratCat, capexCat] = await db.insert(schema.purposeCategories).values([
    { name: 'Strategic Events', status: 'active' },
    { name: 'Internal CAPEX', status: 'active' }
  ]).returning();

  const [subPurpose] = await db.insert(schema.subPurposes).values({
    name: 'Q3 Exhibition Operations',
    purposeCategoryId: stratCat.id,
    purposeType: 'PROJECT',
    totalBudget: 500000,
    status: 'active'
  }).returning();

  // 6. GENERATE 2 REQUESTS PER DEPARTMENT (26 Total)
  console.log('📝 Generating 26 Purchase Requests for Apple-style UI Testing...');
  
  let prCounter = 1;
  const year = new Date().getFullYear();

  for (const dept of insertedDepts) {
    const requester = insertedUsers.find(u => u.department === dept.name);
    if (!requester) continue;

    for (let i = 1; i <= 2; i++) {
        const totalBaseCost = Math.round(15000.75 * i + (prCounter * 100));
        const requestNumber = `PR-${year}-${prCounter.toString().padStart(4, '0')}`;

        // Insert Base Request
        const [request] = await db.insert(schema.purchaseRequests).values({
            requestNumber,
            title: `${dept.name} - Operational Request ${i}`,
            description: `Refined purchase request for ${dept.name} operational needs. Testing Glassmorphism UI rendering and magnetic interactions.`,
            requesterId: requester.id,
            vendorId: testVendor.id,
            purposeType: 'PROJECT',
            purposeCategoryId: stratCat.id,
            subPurposeId: subPurpose.id,
            status: 'pending',
            totalEstimatedCost: totalBaseCost,
            paymentStructure: 'IN_PARTS',
            items: JSON.stringify([{ name: "Hardware Component", quantity: 1, estimatedCost: totalBaseCost }]) as any
        }).returning();

        // 7. INSERT PAYMENT INSTALLMENTS (40/60 Split Validation)
        await db.insert(schema.paymentInstallments).values([
            {
              requestId: request.id,
              vendorId: testVendor.id,
              installmentName: 'Advance Payment (40%)',
              valueType: 'PERCENTAGE',
              amountValue: 40,
              calculatedAmount: Math.round(totalBaseCost * 0.40),
              amount: Math.round(totalBaseCost * 0.40),
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // In 1 week
              createdBy: requester.id,
              status: 'pending'
            },
            {
              requestId: request.id,
              vendorId: testVendor.id,
              installmentName: 'Final Delivery (60%)',
              valueType: 'PERCENTAGE',
              amountValue: 60,
              calculatedAmount: Math.round(totalBaseCost * 0.60),
              amount: Math.round(totalBaseCost * 0.60),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // In 1 month
              createdBy: requester.id,
              status: 'pending'
            }
        ]);

        // 8. INSERT PENDING APPROVALS (System Workflow Mandatory)
        const financeAdmin = insertedUsers.find(u => u.department === 'Finance' && u.role === 'admin');
        const deptManager = insertedUsers.find(u => u.department === dept.name && u.role === 'approver');

        const approvalsToInsert = [];
        // Add Finance Sign-off
        if (financeAdmin) {
            approvalsToInsert.push({
                requestId: request.id,
                approverId: financeAdmin.id,
                department: 'Finance',
                status: 'pending',
                isMandatory: true
            });
        }
        // Add Dept Manager Sign-off (if different from requester)
        if (deptManager && deptManager.id !== requester.id) {
            approvalsToInsert.push({
                requestId: request.id,
                approverId: deptManager.id,
                department: dept.name,
                status: 'pending',
                isMandatory: true
            });
        }

        if (approvalsToInsert.length > 0) {
            await db.insert(schema.approvals).values(approvalsToInsert);
        }

        prCounter++;
    }
  }

  console.log('✅ Seeding Complete! 26 Purchase Requests created successfully.');
  console.log('👉 Log in with: adil@e3.com / Password123!');
}

seed().catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
});
