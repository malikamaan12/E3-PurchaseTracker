/**
 * Manual Test Script for Notification Deduplication Fix
 * 
 * This script provides a manual testing approach for the notification deduplication fix.
 * 
 * Usage: 
 * 1. You must be logged in to the application in a browser
 * 2. Create a purchase request and note its ID
 * 3. Run this script, replacing the requestId with your test ID
 * 4. Check the console output for notification creation
 */

// Replace this with your test request ID
const TEST_REQUEST_ID = 123;

// Execute this test via browser console or by calling API endpoints directly
async function testNotificationDeduplication() {
  console.log(`Starting notification deduplication test for request ID: ${TEST_REQUEST_ID}`);
  
  // Step 1: Count existing notifications
  const before = await fetch(`/api/notifications`).then(r => r.json());
  console.log(`Before test: ${before.length} notifications for current user`);
  
  // Step 2: Trigger a status change
  const updateResponse = await fetch(`/api/requests/${TEST_REQUEST_ID}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'pending'
    })
  });
  
  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    console.error('Failed to update status:', errorData);
    return;
  }
  
  console.log('Status updated to pending');
  
  // Step 3: Wait a moment for async operations
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 4: Count notifications after status change
  const after = await fetch(`/api/notifications`).then(r => r.json());
  console.log(`After test: ${after.length} notifications for current user`);
  
  // Step 5: Check database directly
  console.log(`Net change: ${after.length - before.length} notifications`);
  
  // Group notifications by type to check for duplicates
  const groupByType = notifications => {
    return notifications.reduce((acc, notification) => {
      const type = notification.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(notification);
      return acc;
    }, {});
  };
  
  const byTypeAfter = groupByType(after);
  
  // Check for duplicates
  let duplicatesFound = false;
  
  Object.entries(byTypeAfter).forEach(([type, notifications]) => {
    // Check notifications with the same type that were created within a short time window
    const filtered = notifications.filter(n => n.requestId === TEST_REQUEST_ID);
    
    if (filtered.length > 1) {
      duplicatesFound = true;
      console.error(`Found ${filtered.length} notifications of type "${type}" for request ${TEST_REQUEST_ID}`);
      filtered.forEach(n => console.log(`  - ${n.id}: "${n.title}" created at ${new Date(n.createdAt).toISOString()}`));
    }
  });
  
  if (!duplicatesFound) {
    console.log('✅ No duplicate notifications were detected');
  } else {
    console.error('❌ Duplicate notifications were detected');
  }
}

console.log(`
// Run this test from the browser console (after login) by pasting these lines:

// First update the request ID to a valid test request
const TEST_REQUEST_ID = 123; // Replace with actual ID

// Then run the test
(${testNotificationDeduplication.toString()})();
`);