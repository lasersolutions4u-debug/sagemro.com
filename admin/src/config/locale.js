import { useSyncExternalStore } from 'react';
import { runtimeConfig } from './runtime.js';

const STORAGE_KEY = 'sagemro_admin_locale';
const listeners = new Set();

export function resolveAdminLocale(saved, market = runtimeConfig.market) {
  return market === 'cn' ? 'zh-CN' : saved === 'zh-CN' ? 'zh-CN' : 'en';
}

function readPreference() {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

let locale = resolveAdminLocale(readPreference());
export const getAdminLocale = () => locale;

function updateLocale(value) {
  const next = resolveAdminLocale(value);
  if (next === locale) return;
  locale = next;
  for (const notify of listeners) notify();
}

export function setAdminLocale(value) {
  if (runtimeConfig.market !== 'com' || !['en', 'zh-CN'].includes(value)) return;
  updateLocale(value);
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* Session switching still works without browser storage. */ }
}

function onStorage(event) {
  if (event.key === STORAGE_KEY || event.key === null) updateLocale(readPreference());
}

function subscribe(notify) {
  listeners.add(notify);
  if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function useAdminLocale() {
  return useSyncExternalStore(subscribe, getAdminLocale, getAdminLocale);
}
