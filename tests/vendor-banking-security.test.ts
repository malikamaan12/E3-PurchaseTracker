import { maskAccountNumber, maskIban, maskVendorBanking, maskVendorList } from "../src/lib/utils/masking";

async function testVendorBankingSecurity() {
  console.log("=================================================");
  console.log("    VENDOR BANKING SECURITY ISOLATED TEST        ");
  console.log("=================================================\n");

  let passed = true;

  // 1. Test IBAN masking
  const testIbans = [
    { raw: "QA55CBQA000000001234567890123", expectedSuffix: "0123", expectedPrefix: "QA" },
    { raw: "QA12QNBA000000009988776655443", expectedSuffix: "5443", expectedPrefix: "QA" },
    { raw: "GB29NWBK60161331926819", expectedSuffix: "6819", expectedPrefix: "GB" }
  ];

  for (const item of testIbans) {
    const masked = maskIban(item.raw);
    console.log(`Masked IBAN: "${masked}"`);
    if (!masked.startsWith(item.expectedPrefix) || !masked.endsWith(item.expectedSuffix) || masked.includes(item.raw.slice(4, -4))) {
      console.error(`❌ [FAIL] IBAN masking failed for ${item.raw}`);
      passed = false;
    }
  }

  // 2. Test Account Number masking
  const testAccounts = [
    { raw: "000123456789", expectedSuffix: "6789" },
    { raw: "12345678", expectedSuffix: "5678" }
  ];

  for (const item of testAccounts) {
    const masked = maskAccountNumber(item.raw);
    console.log(`Masked Account: "${masked}"`);
    if (!masked.endsWith(item.expectedSuffix) || !masked.includes("••••")) {
      console.error(`❌ [FAIL] Account number masking failed for ${item.raw}`);
      passed = false;
    }
  }

  // 3. Test Object masking
  const sampleVendor = {
    id: 99,
    companyName: "Safe Qatar Supplies",
    accountNumber: "987654321012",
    ibanNumber: "QA88QNBA000000009876543210123",
    bankName: "QNB",
    contactPerson: "Ahmed Al-Kuwari"
  };

  const maskedObj = maskVendorBanking(sampleVendor);

  if (
    maskedObj.isBankingMasked === true &&
    maskedObj.accountNumber !== sampleVendor.accountNumber &&
    maskedObj.ibanNumber !== sampleVendor.ibanNumber &&
    maskedObj.accountNumber.endsWith("1012") &&
    maskedObj.ibanNumber.endsWith("0123")
  ) {
    console.log("✅ [PASS] Vendor banking credentials sanitized and tagged with isBankingMasked=true");
  } else {
    console.error("❌ [FAIL] Vendor banking object masking failed");
    passed = false;
  }

  // 4. Test List masking
  const sampleList = [sampleVendor, { ...sampleVendor, id: 100, companyName: "Another Vendor" }];
  const maskedList = maskVendorList(sampleList);

  if (maskedList.length === 2 && maskedList.every(v => v.isBankingMasked && v.accountNumber.includes("••••"))) {
    console.log("✅ [PASS] Vendor list batch masking verified.");
  } else {
    console.error("❌ [FAIL] Vendor list batch masking failed");
    passed = false;
  }

  if (!passed) process.exit(1);
}

testVendorBankingSecurity().catch(err => {
  console.error("Security test failed:", err);
  process.exit(1);
});
