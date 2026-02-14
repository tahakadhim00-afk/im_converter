const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { convertBatch, getSupportedOutputFormats } = require('./converter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'IM Converter',
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ──

ipcMain.handle('get-formats', () => {
  return getSupportedOutputFormats();
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Images',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: [
          'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp',
          'tiff', 'tif', 'avif', 'heic', 'heif', 'ico', 'svg',
        ],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Output Folder',
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('convert', async (event, { files, outputFormat, outputDir, options }) => {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    mainWindow.webContents.send('conversion-progress', {
      current: i + 1,
      total,
      file: path.basename(file),
    });

    try {
      const outputPath = await convertBatch(file, outputFormat, outputDir, options);
      results.push({ file, outputPath, success: true });
    } catch (err) {
      results.push({ file, success: false, error: err.message });
    }
  }

  return results;
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});
