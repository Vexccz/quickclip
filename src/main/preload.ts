import { contextBridge, ipcRenderer } from 'electron';
import type { QuickClipAPI, Settings, ClipItem } from '../shared/types';

const api: QuickClipAPI = {
  list: (query?: string) => ipcRenderer.invoke('clips:list', query) as Promise<ClipItem[]>,
  paste: (id: number) => ipcRenderer.invoke('clips:paste', id) as Promise<void>,
  togglePin: (id: number) => ipcRenderer.invoke('clips:togglePin', id) as Promise<void>,
  delete: (id: number) => ipcRenderer.invoke('clips:delete', id) as Promise<void>,
  clearAll: () => ipcRenderer.invoke('clips:clearAll') as Promise<void>,
  hide: () => ipcRenderer.invoke('window:hide') as Promise<void>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  saveSettings: (s: Partial<Settings>) =>
    ipcRenderer.invoke('settings:save', s) as Promise<Settings>,
  openSettings: () => ipcRenderer.invoke('settings:open') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  onUpdate: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('clips:updated', handler);
    ipcRenderer.on('quickpaste:shown', handler);
    return () => {
      ipcRenderer.removeListener('clips:updated', handler);
      ipcRenderer.removeListener('quickpaste:shown', handler);
    };
  }
};

contextBridge.exposeInMainWorld('quickclip', api);
