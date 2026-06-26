const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openGSTPortal: (gst) =>
    ipcRenderer.invoke("open-gst-portal", gst),

  minimize: () => ipcRenderer.send("minimize"),
  maximize: () => ipcRenderer.send("maximize"),
  close: () => ipcRenderer.send("close")
});


// const { contextBridge, ipcRenderer } = require('electron');
// contextBridge.exposeInMainWorld('electron', {
//   minimize: () => ipcRenderer.send('minimize'),
//   maximize: () => ipcRenderer.send('maximize'),
//   close: () => ipcRenderer.send('close')
// });



