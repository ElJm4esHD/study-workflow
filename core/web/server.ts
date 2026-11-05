import { Capacitor } from '@capacitor/core';

export const DEFAULT_SERVER = 'https://tu-server.tu-tailnet.ts.net:8443';
const KEY = 'sw.server';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const getServerUrl = (): string | null => localStorage.getItem(KEY);
export const setServerUrl = (url: string): void => localStorage.setItem(KEY, url);
// En la web el front y la API comparten origen; en nativo se usa la URL configurada.
export const apiBase = (): string => (isNative() ? (getServerUrl() ?? DEFAULT_SERVER).replace(/\/+$/, '') : '');
