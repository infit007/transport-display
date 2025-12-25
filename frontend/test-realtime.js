#!/usr/bin/env node

/**
 * Test script to verify real-time media pushing functionality
 * Run this after starting the backend server to test the socket connections
 */

const io = require('socket.io-client');

const BACKEND_URL = 'https://transport-display.onrender.com';
const TEST_BUS_NUMBER = 'UK-05-H-8001';
const TEST_DEPOT = 'Pithoragarh Depot';

console.log('🧪 Testing real-time media push functionality...');
console.log(`📡 Connecting to backend: ${BACKEND_URL}`);
console.log(`🚌 Testing with bus: ${TEST_BUS_NUMBER}`);
console.log(`🏢 Testing with depot: ${TEST_DEPOT}`);

// Create socket connection
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 10000,
});

// Connection handlers
socket.on('connect', () => {
  console.log('✅ Connected to backend server');
  console.log(`🆔 Socket ID: ${socket.id}`);
  
  // Register as TV display
  const payload = { busNumber: TEST_BUS_NUMBER, depot: TEST_DEPOT };
  socket.emit('tv:register', payload);
  socket.emit('subscribe', payload);
  socket.emit('join', payload);
  
  console.log('📝 Registered as TV display for:', payload);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from server:', reason);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Media update handlers
socket.on('media:update', (data) => {
  console.log('📺 Received media:update:', data);
  console.log('   - Message:', data.message);
  console.log('   - Bus Number:', data.busNumber);
  console.log('   - Bus ID:', data.busId);
  console.log('   - Media Count:', data.mediaCount);
  console.log('   - Media Items:', data.mediaItems?.length || 0);
});

socket.on('media:refresh', (data) => {
  console.log('🔄 Received media:refresh:', data);
  console.log('   - Message:', data.message);
  console.log('   - Bus IDs:', data.busIds);
  console.log('   - Media Count:', data.mediaCount);
});

socket.on('playlist:update', (data) => {
  console.log('📋 Received playlist:update:', data);
  console.log('   - Message:', data.message);
  console.log('   - Bus Number:', data.busNumber);
  console.log('   - Bus ID:', data.busId);
  console.log('   - Media Items:', data.mediaItems?.length || 0);
});

// News handlers
socket.on('news:broadcast', (data) => {
  console.log('📰 Received news:broadcast:', data);
  console.log('   - Title:', data.title);
  console.log('   - Content:', data.content);
  console.log('   - Targets:', data.targets);
});

// Error handlers
socket.on('error', (error) => {
  console.log('❌ Socket error:', error);
});

// Test media assignment (simulate admin panel action)
setTimeout(() => {
  console.log('\n🧪 Testing media assignment...');
  
  // This would normally be called by the admin panel
  const testMediaAssignment = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/media/public/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busIds: ['test-bus-id'], // This would be a real bus ID
          items: [{
            url: 'https://example.com/test-video.mp4',
            type: 'file',
            name: 'Test Video'
          }]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Media assignment response:', result);
      } else {
        console.log('❌ Media assignment failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.log('❌ Media assignment error:', error.message);
    }
  };
  
  // testMediaAssignment();
  console.log('ℹ️  To test media assignment, use the admin panel to push media to buses');
}, 2000);

// Keep the script running
console.log('\n⏳ Listening for real-time updates...');
console.log('   Press Ctrl+C to exit');
console.log('   Use the admin panel to push media and see real-time updates here\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test client...');
  socket.disconnect();
  process.exit(0);
});
