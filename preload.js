const { contextBridge, ipcRenderer } = require('electron');

// Canali IPC consentiti - WHITELIST di sicurezza
const ALLOWED_CHANNELS = [
  'run-scan',           // Scansioni di rete (port-scan, tls-check, ssh-audit)
  'get-app-version',    // Info versione app
  'open-external',      // Apri link nel browser
  'verify-license',     // Verifica firma license key
  'secure-store:set',   // Salva segreti con Electron safeStorage
  'secure-store:get',   // Legge segreti cifrati
  'secure-store:delete',// Elimina segreti cifrati
];

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (ALLOWED_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      console.error(`[Preload] Canale bloccato: ${channel}`);
      return Promise.reject(new Error(`Canale "${channel}" non consentito`));
    }
  },
  secureStore: {
    set: (key, value) => ipcRenderer.invoke('secure-store:set', { key, value }),
    get: (key) => ipcRenderer.invoke('secure-store:get', key),
    delete: (key) => ipcRenderer.invoke('secure-store:delete', key),
  },
  platform: process.platform,
  arch: process.arch,
});
