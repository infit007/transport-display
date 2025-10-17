#!/usr/bin/env node

/**
 * Test script to verify media pushing functionality
 * This script simulates pushing media to a bus and checks if the backend responds correctly
 */

const BACKEND_URL = 'http://localhost:4000';
const TEST_BUS_ID = '8209dc2e-84df-4cff-989f-d43d841405aa'; // UK-05-H-8001
const TEST_BUS_NUMBER = 'UK-05-H-8001';

console.log('🧪 Testing Media Push Functionality...');
console.log(`📡 Backend: ${BACKEND_URL}`);
console.log(`🚌 Test Bus: ${TEST_BUS_NUMBER} (ID: ${TEST_BUS_ID})`);

async function testMediaPush() {
  try {
    // Test 1: Check current media for the bus
    console.log('\n1️⃣ Checking current media for bus...');
    const currentMediaResponse = await fetch(`${BACKEND_URL}/api/media/public/bus/${TEST_BUS_ID}`);
    const currentMedia = await currentMediaResponse.json();
    console.log(`   Current media count: ${currentMedia.length}`);
    console.log(`   Current media:`, currentMedia.map(m => m.name));

    // Test 2: Push new media to the bus
    console.log('\n2️⃣ Pushing new media to bus...');
    const newMedia = {
      busIds: [TEST_BUS_ID],
      items: [
        {
          url: 'https://example.com/test-video-1.mp4',
          type: 'file',
          name: 'Test Video 1'
        },
        {
          url: 'https://example.com/test-video-2.mp4',
          type: 'file',
          name: 'Test Video 2'
        }
      ]
    };

    const pushResponse = await fetch(`${BACKEND_URL}/api/media/public/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMedia)
    });

    if (!pushResponse.ok) {
      throw new Error(`Push failed: ${pushResponse.status} ${pushResponse.statusText}`);
    }

    const pushResult = await pushResponse.json();
    console.log(`   Push result:`, pushResult);

    // Test 3: Check media after push
    console.log('\n3️⃣ Checking media after push...');
    const newMediaResponse = await fetch(`${BACKEND_URL}/api/media/public/bus/${TEST_BUS_ID}`);
    const newMediaData = await newMediaResponse.json();
    console.log(`   New media count: ${newMediaData.length}`);
    console.log(`   New media:`, newMediaData.map(m => m.name));

    // Test 4: Check if media was replaced (should only have the new media)
    console.log('\n4️⃣ Verifying media replacement...');
    if (newMediaData.length === 2 && 
        newMediaData.every(m => m.name.includes('Test Video'))) {
      console.log('   ✅ Media replacement working correctly!');
    } else {
      console.log('   ❌ Media replacement not working - old media still present');
    }

    // Test 5: Check connected clients
    console.log('\n5️⃣ Checking connected clients...');
    const clientsResponse = await fetch(`${BACKEND_URL}/api/debug/clients`);
    const clientsData = await clientsResponse.json();
    console.log(`   Connected clients: ${clientsData.totalClients}`);
    console.log(`   Rooms:`, clientsData.rooms);

    console.log('\n✅ Media push test completed!');
    console.log('\n📺 Check your TV display - it should now show only the new test videos');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testMediaPush();
