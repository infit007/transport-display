// API service for TV Display App to connect to backend
const BACKEND_URL = 'https://transport-display.onrender.com';

class TVDisplayAPI {
  constructor() {
    this.baseURL = BACKEND_URL;
  }

  async request(endpoint, options = {}) {
    // Add cache-busting on GETs so updated media/news are fetched fresh
    let url = `${this.baseURL}${endpoint}`;
    try {
      const method = (options.method || 'GET').toUpperCase();
      if (method === 'GET') {
        const u = new URL(url);
        u.searchParams.set('_cb', Date.now().toString());
        url = u.toString();
      }
    } catch {}
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'omit', // Don't send credentials for now
      ...options,
    };

    try {
      console.log(`Making API request to: ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      
      // If it's a CORS error, provide more helpful information
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        console.error('CORS Error: The backend needs to allow requests from this domain');
        console.error('Backend URL:', this.baseURL);
        console.error('Request URL:', url);
      }
      
      throw error;
    }
  }

  // Get all buses
  async getBuses() {
    return this.request('/api/buses/public');
  }

  // Get specific bus by number
  async getBusByNumber(busNumber) {
    return this.request(`/api/buses/public/${encodeURIComponent(busNumber)}`);
  }

  // Get all media
  async getMedia() {
    return this.request('/api/media/public');
  }

  // Get media for specific bus
  async getMediaForBus(busId) {
    return this.request(`/api/media/public/bus/${encodeURIComponent(busId)}`);
  }

  // Get news feeds
  async getNews() {
    return this.request('/api/news/public');
  }

  // Health check
  async healthCheck() {
    return this.request('/api/health');
  }
}

export const tvDisplayAPI = new TVDisplayAPI();