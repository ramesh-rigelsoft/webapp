const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let win;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 👉 React app open
  win.loadURL("http://localhost:5173/cms-ui/phq/gst");
}

app.whenReady().then(createWindow);

/* ===============================
   GST PORTAL OPEN + FOCUS + FILL
================================= */

ipcMain.handle("open-gst-portal", (event, gst) => {
  if (!win) return;

  win.webContents.stop();

  win.loadURL("https://services.gst.gov.in/services/searchtp");

  win.webContents.once("did-finish-load", () => {
    win.webContents.executeJavaScript(`
      (function () {
        const gstValue = ${JSON.stringify(gst)};

        const setNativeValue = (el, value) => {
          const proto = Object.getPrototypeOf(el);
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

          if (setter) setter.call(el, value);
          else el.value = value;

          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur"));
        };

        const timer = setInterval(() => {
          const input = document.querySelector("#for_gstin");

          if (input) {

            // ✅ bring into view
            input.scrollIntoView({ block: "center", behavior: "smooth" });

            // ✅ force interaction
            input.click();
            input.focus();

            // ✅ set value safely
            setNativeValue(input, gstValue);

            // ✅ refocus (React override fix)
            setTimeout(() => input.focus(), 150);

            clearInterval(timer);
          }
        }, 300);
      })();
    `);
  });
});

/* ===============================
   WINDOW CONTROLS
================================= */

ipcMain.on("minimize", () => win.minimize());

ipcMain.on("maximize", () => {
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on("close", () => win.close());

/* ===============================
   APP READY
================================= */

app.whenReady().then(() => {
  if (!win) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

//  option-2
// const { app, BrowserWindow, ipcMain, screen } = require("electron");
// const path = require("path");

// let win;

// function createWindow() {
//   const { width, height } = screen.getPrimaryDisplay().workAreaSize;

//   win = new BrowserWindow({
//     width,
//     height,
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//       contextIsolation: true,
//       nodeIntegration: false
//     }
//   });

//   // 👉 Step 1: React app open
//   win.loadURL("http://localhost:5173/cms-ui/phq/gst");
// }

// app.whenReady().then(createWindow);

// /* ===============================
//    GST PORTAL OPEN + AUTO FILL
// ================================= */

// ipcMain.handle("open-gst-portal", (event, gst) => {
//   if (!win) return;

//   // stop any running navigation
//   win.webContents.stop();

//   // open GST portal
//   win.loadURL("https://services.gst.gov.in/services/searchtp");

//   // wait for page load safely
//   win.webContents.once("did-finish-load", () => {
//     win.webContents.executeJavaScript(`
//       (function () {
//         const gstValue = ${JSON.stringify(gst)};

//         const timer = setInterval(() => {
//           const input = document.querySelector("#for_gstin");

//           if (input) {
//             input.value = gstValue;
//             input.dispatchEvent(new Event("input", { bubbles: true }));
//             input.dispatchEvent(new Event("change", { bubbles: true }));
//             clearInterval(timer);
//           }
//         }, 300);
//       })();
//     `);
//   });
// });

// /* ===============================
//    WINDOW CONTROLS
// ================================= */

// ipcMain.on("minimize", () => win.minimize());

// ipcMain.on("maximize", () => {
//   if (win.isMaximized()) win.unmaximize();
//   else win.maximize();
// });

// ipcMain.on("close", () => win.close());

// /* ===============================
//    APP READY
// ================================= */

// app.whenReady().then(() => {
//   if (!win) createWindow();
// });

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") {
//     app.quit();
//   }
// });

// ipcMain.handle("open-gst-portal", async (event, gst) => {
//   if (!win) return;

//   await win.loadURL("https://services.gst.gov.in/services/searchtp");

//   win.webContents.once("did-finish-load", () => {
//     win.webContents.executeJavaScript(`
//       const timer = setInterval(() => {
//         const input = document.querySelector("#for_gstin");

//         if (input) {
//           input.value = "${gst}";
//           input.dispatchEvent(new Event("input", { bubbles: true }));
//           input.dispatchEvent(new Event("change", { bubbles: true }));
//           clearInterval(timer);
//         }
//       }, 300);
//     `);
//   });
// });


// const { app, BrowserWindow, ipcMain,screen } = require('electron');

// let win;



// function createWindow() {
//   const { width, height } = screen.getPrimaryDisplay().workAreaSize;
//   win = new BrowserWindow({
//     width,
//     height,
//     frame: true,
//     resizable: false,
//     maximizable: false,
//     webPreferences: {
//       preload: require('path').join(__dirname, 'preload.js'),
//       contextIsolation: true
//     },
// }


// );

//   win.loadURL("http://localhost:8091");
//   // win.loadFile("index.html");
// }

// ipcMain.on('minimize', () => win.minimize());
// ipcMain.on('maximize', () => {
//   if (win.isMaximized()) win.unmaximize();
//   else win.maximize();
// });
// ipcMain.on('close', () => win.close());

// app.whenReady().then(createWindow);
