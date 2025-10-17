// Simple backend configuration for TV Display App
// This version doesn't rely on import.meta.env to avoid compatibility issues

const getBackendUrl = () => {
  // Check for localhost indicator (useful for development)
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    // If running on localhost, default to local backend
    return 'http://localhost:4000';
  }
  
  // Default to production backend
  return 'https://transport-display.onrender.com';
};

export const BACKEND_URL = getBackendUrl();

// Log the backend URL being used (for debugging)
console.log('🔗 TV Display App using backend:', BACKEND_URL);

export default {
  BACKEND_URL
};
