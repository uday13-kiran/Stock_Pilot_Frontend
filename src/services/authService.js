import { apiGet, apiPost } from './api.js';
export async function login(email,password) {
  const result = await apiPost('/auth/login',{email,password});
  if (!result?.access_token) throw new Error('The API response did not include an access token.');
  sessionStorage.setItem('stockpiolet_token',result.access_token);
  return result;
}
export async function getMe(){ return apiGet('/auth/me'); }
export function clearSession(){sessionStorage.removeItem('stockpiolet_token');}
