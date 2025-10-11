import axios from 'axios';
import { io } from 'socket.io-client';
import { getToken } from './auth';

// Get base URL with fallback to localhost if not specified
const RAW_BASE = window.localStorage.getItem('CMS_BASE_URL') || process.env.CMS_BASE_URL || 'http://localhost:4000';
const BASE_URL = RAW_BASE ? RAW_BASE.replace(/\/$/, '') : '';

console.log('API connecting to:', BASE_URL || 'No backend URL configured');

const api = axios.create({ 
  baseURL: BASE_URL, 
  timeout: 15000,
  // Add fallback for when no backend is configured
  validateStatus: (status) => status < 500, // Only throw on server errors
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const t = getToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with a status code outside of 2xx
      console.error('API Error Response:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('API No Response:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('API Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const registerDevice = async ({ deviceName, location, approvalCode }) => {
  try {
    const { data } = await api.post('/api/devices/register', { deviceName, location, approvalCode });
    return data;
  } catch (error) {
    console.error('Device registration failed:', error);
    throw error;
  }
};

export const validate = async (token) => {
  if (!token) return false;
  if (!BASE_URL) return true; // Allow demo mode when no backend
  try {
    const response = await api.get('/api/devices/validate');
    return response.status === 200;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};

export const getContent = async (deviceId) => {
  if (!BASE_URL) {
    console.log('No backend URL configured, returning demo content');
    // Return demo content when no backend is configured
    return {
      items: [
        { type: 'text', text: 'Demo Mode - No Backend Configured' },
        { type: 'text', text: `Device ID: ${deviceId || 'Not set'}` }
      ],
      ticker: 'Welcome to FleetSignage TV Display - Demo Mode'
    };
  }
  
  try {
    const { data } = await api.get('/api/devices/content', { params: { deviceId } });
    return data;
  } catch (error) {
    console.error('Failed to fetch content:', error);
    // Return demo content on error
    return {
      items: [
        { type: 'text', text: 'Demo Mode - Backend Error' },
        { type: 'text', text: `Device ID: ${deviceId || 'Not set'}` },
        { type: 'text', text: `Error: ${error.message}` }
      ],
      ticker: 'Welcome to FleetSignage TV Display - Demo Mode (Error)'
    };
  }
};

export const openSocket = () => {
  if (!BASE_URL) {
    console.log('No backend URL configured, returning mock socket');
    return { 
      on: () => {}, 
      close: () => {},
      connected: false
    };
  }
  
  try {
    const socket = io(BASE_URL, { 
      transports: ['websocket'], 
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
    
    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    return socket;
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    return { on: () => {}, close: () => {}, connected: false };
  }
};

export default api;



