#!/usr/bin/env node

/**
 * Test script for race condition fix
 * Sends 3 parallel requests to /api/external/add-item
 * and verifies all items are saved
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function sendRequest(name) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/external/add-item',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          console.log(`✓ Response for "${name}":`, response.success ? 'SUCCESS' : 'FAILED');
          resolve({ name, response, status: res.statusCode });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`✗ Request failed for "${name}":`, error.message);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

function getList() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/shopping/list',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response.data);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('\n🧪 Testing Race Condition Fix\n');
  console.log('═'.repeat(50));

  // Get initial state
  console.log('\n1. Getting initial list...');
  const initialList = await getList();
  const initialCount = initialList.items.length;
  console.log(`   Initial items: ${initialCount}`);

  // Send 3 parallel requests
  console.log('\n2. Sending 3 parallel requests...');
  const items = ['Honig', 'Eier', 'Lasagneblätter'];

  const startTime = Date.now();
  const results = await Promise.all(items.map(name => sendRequest(name)));
  const duration = Date.now() - startTime;

  console.log(`   Duration: ${duration}ms`);

  // Wait a bit for file system to settle
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get final state
  console.log('\n3. Verifying results...');
  const finalList = await getList();
  const finalCount = finalList.items.length;
  const addedCount = finalCount - initialCount;

  console.log(`   Final items: ${finalCount}`);
  console.log(`   Added items: ${addedCount}`);

  // Verify all items were added
  console.log('\n4. Checking for expected items...');
  const addedItems = finalList.items.slice(-3);
  const itemNames = addedItems.map(item => item.name);

  let allFound = true;
  for (const expectedName of items) {
    const found = itemNames.includes(expectedName);
    console.log(`   ${found ? '✓' : '✗'} ${expectedName}: ${found ? 'FOUND' : 'MISSING'}`);
    if (!found) allFound = false;
  }

  // Final verdict
  console.log('\n' + '═'.repeat(50));
  if (addedCount === 3 && allFound) {
    console.log('✅ TEST PASSED: All 3 items were saved successfully!');
    console.log('   Race condition is FIXED! 🎉\n');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED: Race condition still exists!');
    console.log(`   Expected 3 items, but only ${addedCount} were saved.\n`);
    process.exit(1);
  }
}

// Run test
runTest().catch(error => {
  console.error('\n❌ Test failed with error:', error.message);
  process.exit(1);
});
