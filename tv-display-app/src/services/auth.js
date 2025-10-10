import { validate as validateApi } from './api';

const TOKEN_KEY = 'tv_token';
const DEVICE_ID_KEY = 'tv_device_id';
const REGISTERED_KEY = 'tv_registered';

export const saveRegistration = (token, deviceId) => {
  localStorage.setItem(TOKEN_KEY, token);
  if (deviceId) localStorage.setItem(DEVICE_ID_KEY, deviceId);
  localStorage.setItem(REGISTERED_KEY, '1');
};

export const isRegistered = () => localStorage.getItem(REGISTERED_KEY) === '1';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getDeviceId = () => localStorage.getItem(DEVICE_ID_KEY);
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REGISTERED_KEY);
};

export const validateToken = async (token) => validateApi(token);



