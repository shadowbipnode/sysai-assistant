const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let proxyProcess;

// Percorso dei binari inclusi nell'app
const getBinPath = (binName) => {
  const localPath = path.join(__dirname, 'bin', binName);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return binName; // fallback al sistema
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'src/assets/icon.png'),
    titleBarStyle: 'default',
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function startProxy() {
  const serverPath = path.join(__dirname, 'server.js');
  if (fs.existsSync(serverPath)) {
    proxyProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      detached: false,
      env: { ...process.env, PORT: 3001 }
    });
    
    proxyProcess.on('error', (err) => {
      console.error('Failed to start proxy:', err);
    });
  } else {
    console.error('server.js not found');
  }
}

// Handler per eseguire comandi di sistema con percorsi locali
ipcMain.handle('run-command', async (event, command) => {
  // Sostituisci con percorsi locali se disponibili
  let finalCommand = command;
  
  if (command.startsWith('nmap ')) {
    const localNmap = getBinPath('nmap');
    finalCommand = command.replace('nmap', localNmap);
  } else if (command.startsWith('sslscan ')) {
    const localSslscan = getBinPath('sslscan');
    finalCommand = command.replace('sslscan', localSslscan);
  } else if (command.startsWith('ssh-audit ')) {
    const localSshAudit = getBinPath('ssh-audit');
    finalCommand = command.replace('ssh-audit', localSshAudit);
  } else if (command.startsWith('python3 -m ssh_audit')) {
    const parts = command.split(' ');
    const target = parts[parts.length - 1];
    finalCommand = `python3 -m ssh_audit ${target}`;
  }
  
  return new Promise((resolve) => {
    console.log('Executing command:', finalCommand);
    exec(finalCommand, { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Command error:', error.message);
        resolve({ success: false, output: stderr || error.message });
      } else {
        console.log('Command completed, output length:', stdout.length);
        resolve({ success: true, output: stdout });
      }
    });
  });
});

app.whenReady().then(() => {
  startProxy();
  createWindow();
});

app.on('window-all-closed', () => {
  if (proxyProcess) {
    proxyProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
