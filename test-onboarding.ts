async function testOnboarding() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImVtYWlsIjoiaGVsbG9AZTMuY29tIiwiZGVwYXJ0bWVudCI6IklUIiwicm9sZSI6ImFkbWluIiwiY29udGFjdE51bWJlciI6IjEyMy00NTYtNzg5MCIsImlzQWN0aXZlIjp0cnVlLCJpYXQiOjE3NzUxNjI2MjV9.9HWhleZ3-qe4m77kZKKGQ4kv6hH4eXWXb_ZLgvnqNDDANBY";
  const body = {
    companyName: "Automated Test Vendor " + Date.now(),
    contactPerson: "John Doe",
    contactNumber: "12345678",
    email: "test@vendor.com",
    address: "123 Local St",
    bankName: "Local Bank",
    accountNumber: "1234 5678 90", // Testing spaces
    ibanNumber: "QA66 QNBA 0000 1234 5678 90", // Testing spaces
    branchName: "Main Branch",
    category: "general",
    payment_currency: "QAR"
  };

  try {
    console.log("Starting local vendor onboarding test...");
    const response = await fetch("http://localhost:5000/api/backend/vendors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `auth_token=${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("SUCCESS: Vendor onboarded with spaces in bank details!");
    } else {
      console.log("FAILURE: Onboarding failed.");
    }
  } catch (err) {
    console.error("Connection Error:", err);
  }
}

testOnboarding();
