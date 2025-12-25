#!/usr/bin/env node

/**
 * Script to help restart the backend server
 * This will kill any existing backend processes and provide instructions
 */

const { spawn, exec } = require('child_process');

console.log('🔄 Backend Restart Helper');
console.log('========================\n');

// Check if backend is running on port 4000
exec('netstat -ano | findstr :4000', (error, stdout, stderr) => {
  if (stdout) {
    console.log('📡 Backend is currently running on port 4000');
    console.log('🔍 Running processes:');
    console.log(stdout);
    
    console.log('\n⚠️  To restart the backend:');
    console.log('1. Go to your backend terminal');
    console.log('2. Press Ctrl+C to stop the server');
    console.log('3. Run: npm start');
    console.log('\nOr manually kill the process:');
    
    // Extract process IDs
    const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        console.log(`   taskkill /PID ${pid} /F`);
      }
    });
  } else {
    console.log('📡 No backend running on port 4000');
    console.log('\n✅ You can start the backend with:');
    console.log('   cd backend');
    console.log('   npm start');
  }
  
  console.log('\n🧪 After restarting, test with:');
  console.log('   curl http://localhost:4000/api/health');
  console.log('\n📺 Then test media assignment in the admin panel');
});
