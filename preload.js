const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // openGSTPortal: (gst) => ipcRenderer.invoke("open-gst-portal", gst),

   openGSTPortal: (gst) => ipcRenderer.invoke("open-gst-portal", gst),

  onGSTData: (callback) => {
    ipcRenderer.on("gst-data", (event, data) => {
      callback(data);
    });
  },

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



