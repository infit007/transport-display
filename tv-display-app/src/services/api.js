import axios from 'axios';
import { io } from 'socket.io-client';
import { getToken } from './auth';

const RAW_BASE = window.localStorage.getItem('CMS_BASE_URL') || process.env.CMS_BASE_URL || '';
const BASE_URL = RAW_BASE ? RAW_BASE.replace(/\/$/, '') : '';

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
  if (!BASE_URL) return false; // no backend set yet, force registration UI
  try {
    await api.get('/api/auth/validate');
    return true;
  } catch {
    return false;
  }
};

export const getContent = async (deviceId) => {
  if (!BASE_URL) throw new Error('CMS_BASE_URL not set');
  const { data } = await api.get('/api/content', { params: { deviceId } });
  return data;
};

export const openSocket = () => {
  if (!BASE_URL) return { on: () => {}, close: () => {} };
  return io(BASE_URL, { transports: ['websocket'], autoConnect: true });
};

export default api;



