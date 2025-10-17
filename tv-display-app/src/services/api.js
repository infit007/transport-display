// API service for TV Display App to connect to backend
import { BACKEND_URL } from '../config/backend-simple.js';

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
        // Surface a concise error message to callers; avoid flooding console
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
        // Downgrade to warning to reduce noise in TV runtime
        console.warn(`API request failed for ${endpoint}:`, err.message);
        throw err;
      }
      return await response.json();
    } catch (error) {
      // Keep logs minimal for TV runtime stability
      console.warn(`API request failed for ${endpoint}:`, error?.message || error);
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

  // Get media for specific bus by bus number
  async getMediaForBusNumber(busNumber) {
    return this.request(`/api/media/public/bus-number/${encodeURIComponent(busNumber)}`);
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