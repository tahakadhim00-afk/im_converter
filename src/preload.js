const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFormats: () => ipcRenderer.invoke('get-formats'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  convert: (payload) => ipcRenderer.invoke('convert', payload),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  onProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (event, data) => callback(data));
  },
});
