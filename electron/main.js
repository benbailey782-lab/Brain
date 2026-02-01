import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import { initializeOllama, startHealthMonitor } from './ollama-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config file path
const configPath = path.join(app.getPath('userData'), 'config.json');

// Default config
const defaultConfig = {
  watchFolder: path.join(app.getPath('documents'), 'Prism', 'transcripts'),
  emailFolder: '',
  ollamaModel: 'llama3.1:8b',
  setupComplete: false,
  windowBounds: { width: 1280, height: 800, x: undefined, y: undefined }
};

let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let actualPort = 3001;

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
  return defaultConfig;
}

// Save config
function saveConfig(config) {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Find available port
async function findAvailablePort(startPort) {
  const net = await import('net');
  return new Promise((resolve) => {
    const server = net.default.createServer();
    server.unref();
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

// Check if port is available
async function isPortAvailable(port) {
  const net = await import('net');
  return new Promise((resolve) => {
    const server = net.default.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

// Wait for server health
async function waitForHealth(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// Get icon path
function getIconPath() {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', 'assets', 'icon.png');
  }
  return path.join(process.resourcesPath, 'assets', 'icon.png');
}

// Get tray icon path
function getTrayIconPath() {
  const isDev = !app.isPackaged;
  const iconName = process.platform === 'darwin' ? 'tray-icon.png' : 'tray-icon.png';
  if (isDev) {
    return path.join(__dirname, '..', 'assets', iconName);
  }
  return path.join(process.resourcesPath, 'assets', iconName);
}

// Create splash window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#09090b',
    resizable: false,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashPath = path.join(__dirname, 'splash.html');
  splashWindow.loadFile(splashPath);

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  return splashWindow;
}

// Update splash status
function updateSplashStatus(status) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      if (typeof updateStatus === 'function') {
        updateStatus('${status}');
      }
    `).catch(() => {});
  }
}

// Create main window
function createMainWindow(config) {
  const iconPath = getIconPath();
  const bounds = config.windowBounds;

  mainWindow = new BrowserWindow({
    width: bounds.width || 1280,
    height: bounds.height || 800,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Prism',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    config.windowBounds = bounds;
    saveConfig(config);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Setup system tray (Windows)
function setupTray(config) {
  if (process.platform !== 'win32') return;

  const trayIconPath = getTrayIconPath();
  if (!fs.existsSync(trayIconPath)) {
    console.warn('Tray icon not found:', trayIconPath);
    return;
  }

  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Prism',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Prism - Intelligence Engine');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Start the backend server
async function startServer(config) {
  const isDev = !app.isPackaged;

  // Set environment variables
  const dataPath = path.join(app.getPath('userData'), 'data');
  const uploadsPath = path.join(app.getPath('userData'), 'uploads');

  // Ensure directories exist
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  // Ensure watch folder exists
  if (config.watchFolder && !fs.existsSync(config.watchFolder)) {
    fs.mkdirSync(config.watchFolder, { recursive: true });
  }

  if (isDev) {
    // In development, the server is already running via concurrently on port 3001
    // Just return the known port — don't try to find or start anything
    actualPort = 3001;
    return actualPort;
  }

  // Production: set env vars and start server in-process
  process.env.ELECTRON = 'true';
  process.env.DB_PATH = path.join(dataPath, 'prism.db');
  process.env.UPLOADS_DIR = uploadsPath;
  process.env.WATCH_FOLDER = config.watchFolder || path.join(app.getPath('documents'), 'Prism', 'transcripts');
  process.env.EMAIL_FOLDER = config.emailFolder || '';

  // Find available port for production
  actualPort = await findAvailablePort(3001);
  process.env.PORT = String(actualPort);

  try {
    const serverPath = path.join(process.resourcesPath, 'app.asar', 'src', 'server.js');
    const serverModule = await import(`file://${serverPath}`);
    return actualPort;
  } catch (err) {
    console.error('Failed to start server:', err);
    throw err;
  }
}

// Main app initialization
async function initialize() {
  const config = loadConfig();

  // Create splash screen
  createSplashWindow();

  // Create main window (hidden)
  createMainWindow(config);

  // Grant microphone permissions for Web Speech API
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'microphone', 'audio-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowedPermissions = ['media', 'microphone', 'audio-capture'];
    return allowedPermissions.includes(permission);
  });

  // Setup tray
  setupTray(config);

  try {
    updateSplashStatus('Initializing database...');
    await new Promise(r => setTimeout(r, 500));

    updateSplashStatus('Starting server...');
    const port = await startServer(config);

    updateSplashStatus('Looking for Ollama...');
    const ollamaStatus = await initializeOllama();

    if (ollamaStatus.running && ollamaStatus.modelAvailable) {
      updateSplashStatus('Ollama connected — ' + config.ollamaModel + ' ✓');
    } else if (ollamaStatus.running && !ollamaStatus.modelAvailable) {
      updateSplashStatus('Ollama connected — model not found');
    } else {
      updateSplashStatus('Ollama not found — AI features disabled');
    }
    await new Promise(r => setTimeout(r, 1000));

    updateSplashStatus('Waiting for server...');
    const healthy = await waitForHealth(port, 30);

    if (!healthy) {
      throw new Error('Server failed to start');
    }

    updateSplashStatus('Ready');
    await new Promise(r => setTimeout(r, 500));

    // Load the main UI
    const isDev = !app.isPackaged;
    const loadURL = isDev ? 'http://localhost:3000' : `http://localhost:${port}`;

    await mainWindow.loadURL(loadURL);

    // Show main window and close splash
    mainWindow.show();

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    // Start Ollama health monitoring (after main window shows)
    startHealthMonitor((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ollama-status', status);
      }
    });

  } catch (err) {
    console.error('Initialization failed:', err);
    updateSplashStatus('Error: ' + err.message);

    await new Promise(r => setTimeout(r, 3000));
    app.quit();
  }
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Transcript Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, newConfig) => {
  const config = loadConfig();
  const merged = { ...config, ...newConfig };
  saveConfig(merged);
  return merged;
});

// App lifecycle
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const config = loadConfig();
    createMainWindow(config);
  }
});

app.on('before-quit', () => {
  // Cleanup server process if needed
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Set app ID for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.prism.app');
}
