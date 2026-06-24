const { app, BrowserWindow, ipcMain } = require('electron');

let win;



function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    maximizable: false,
    frame: false,
    
  webPreferences: {
  preload: require('path').join(__dirname, 'preload.js'),
  contextIsolation: true
  },

}


);

  // win.loadURL("http://localhost:8091");
  win.loadFile("index.html");
}

ipcMain.on('minimize', () => win.minimize());
ipcMain.on('maximize', () => {
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('close', () => win.close());

app.whenReady().then(createWindow);
