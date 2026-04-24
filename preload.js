const { contextBridge, ipcRenderer } = require('electron');

// Canali IPC consentiti - WHITELIST di sicurezza
const ALLOWED_CHANNELS = [
  'run-scan',        // Scansioni di rete (port-scan, tls-check, ssh-audit)
  'get-app-version', // Info versione app
  'open-external',   // Apri link nel browser
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
  // Esponi info piattaforma per la UI
  platform: process.platform,
  arch: process.arch,
});
