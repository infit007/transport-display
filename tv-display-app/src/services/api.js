import axios from 'axios';
import { io } from 'socket.io-client';
import { getToken } from './auth';

const BASE_URL = (window.localStorage.getItem('CMS_BASE_URL') || process.env.CMS_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const registerDevice = async ({ deviceName, location, approvalCode }) => {
  const { data } = await api.post('/api/register-device', { deviceName, location, approvalCode });
  return data;
};

export const validate = async (token) => {
  if (!token) return false;
  try {
    await api.get('/api/auth/validate');
    return true;
  } catch {
    return false;
  }
};

export const getContent = async (deviceId) => {
  const { data } = await api.get('/api/content', { params: { deviceId } });
  return data;
};

export const openSocket = () => io(BASE_URL, { transports: ['websocket'], autoConnect: true });

export default api;



