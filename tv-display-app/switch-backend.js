#!/usr/bin/env node

/**
 * Script to easily switch between production and local backend for TV Display App
 * Usage:
 *   node switch-backend.js local    # Switch to local backend
 *   node switch-backend.js prod     # Switch to production backend
 *   node switch-backend.js status   # Check current backend
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'src', 'config', 'backend-simple.js');
const BACKUP_FILE = path.join(__dirname, 'src', 'config', 'backend-simple.js.backup');

const BACKENDS = {
  local: 'http://localhost:4000',
  prod: 'https://transport-display.onrender.com'
};

function getCurrentBackend() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (content.includes(BACKENDS.local)) {
      return 'local';
    } else if (content.includes(BACKENDS.prod)) {
      return 'prod';
    }
    return 'unknown';
  } catch (error) {
    return 'error';
  }
}

function switchBackend(target) {
  if (!BACKENDS[target]) {
    console.error('❌ Invalid backend. Use "local" or "prod"');
    return;
  }

  try {
    // Create backup
    if (fs.existsSync(CONFIG_FILE)) {
      fs.copyFileSync(CONFIG_FILE, BACKUP_FILE);
    }

    const configContent = `// Simple backend configuration for TV Display App
// This version doesn't rely on import.meta.env to avoid compatibility issues

const getBackendUrl = () => {
  // Check for localhost indicator (useful for development)
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    // If running on localhost, default to local backend
    return 'http://localhost:4000';
  }
  
  // Default to ${target} backend
  return '${BACKENDS[target]}';
};

export const BACKEND_URL = getBackendUrl();

// Log the backend URL being used (for debugging)
console.log('🔗 TV Display App using backend:', BACKEND_URL);

export default {
  BACKEND_URL
};`;

    fs.writeFileSync(CONFIG_FILE, configContent);
    
    console.log(`✅ Switched to ${target} backend: ${BACKENDS[target]}`);
    console.log(`📁 Config file: ${CONFIG_FILE}`);
    console.log(`💾 Backup saved: ${BACKUP_FILE}`);
    
  } catch (error) {
    console.error('❌ Error switching backend:', error.message);
  }
}

function showStatus() {
  const current = getCurrentBackend();
  console.log('📊 Current Backend Status:');
  console.log(`   Current: ${current}`);
  console.log(`   Available backends:`);
  Object.entries(BACKENDS).forEach(([name, url]) => {
    const indicator = name === current ? '✅' : '  ';
    console.log(`   ${indicator} ${name}: ${url}`);
  });
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'local':
    switchBackend('local');
    break;
  case 'prod':
    switchBackend('prod');
    break;
  case 'status':
    showStatus();
    break;
  default:
    console.log('🔧 TV Display App Backend Switcher');
    console.log('');
    console.log('Usage:');
    console.log('  node switch-backend.js local    # Switch to local backend');
    console.log('  node switch-backend.js prod     # Switch to production backend');
    console.log('  node switch-backend.js status   # Check current backend');
    console.log('');
    showStatus();
    break;
}
