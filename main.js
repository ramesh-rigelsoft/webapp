const { app, BrowserWindow, ipcMain, screen,Menu,session,net    } = require("electron");
const path = require("path");
const fs = require("fs");
const { startBackend, stopBackend,waitForBackend} = require("./backend");
const log = require('electron-log');
const BASE_URL_ONLINE="http://localhost:5173/cms-ui/";
let loaderWindow = null;


// ===== LOG FILE =====
log.transports.file.resolvePath = () =>
  path.join(app.getPath("userData"), "logs", "main.log");

log.transports.file.level = "info";
log.transports.console.level = "debug";

log.catchErrors({
  showDialog: false
});


app.whenReady().then(() => {

  log.info("========== APP START ==========");

   const dbDir = path.join(app.getPath("userData"), "data");

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // ❌ JS CRASH
  process.on("uncaughtException", (err) => {
    log.error("UNCaught Exception:", err);
  });

  // ❌ PROMISE CRASH
  process.on("unhandledRejection", (reason) => {
    log.error("Unhandled Rejection:", reason);
  });

  // ⚠️ WARNINGS
  process.on("warning", (w) => {
    log.warn("Warning:", w);
  });

  // 💻 ELECTRON EVENTS
  app.on("render-process-gone", (event, webContents, details) => {
    log.error("Renderer Crashed:", details);
  });

  app.on("child-process-gone", (event, details) => {
    log.error("Child Process Crashed:", details);
  });

  app.on("before-quit", () => log.info("Before Quit"));
  app.on("will-quit", () => log.info("Will Quit"));
  app.on("quit", () => log.info("Quit"));

});

////-------------------------------------

/////log part end

// top part :--------------------
  

let win;
let gstWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = path.join(__dirname, "logo.ico");
  console.log("ICON PATH:", iconPath);
  win = new BrowserWindow({
    width,
    height,
    icon: iconPath,
    resizable: false, 
      
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

 // ✅ attach FIRST
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.log("Load failed:", errorCode, errorDescription);

    if (
      errorCode === -102 ||  // connection refused
      errorCode === -106 ||  // internet down
      errorCode === -105     // DNS fail
    ) {
      win.loadFile("serverdown.html");
    }
  });

  // ✅ then load
  win.loadURL(BASE_URL_ONLINE);

 }

  app.whenReady().then(createWindow);

  // top part end



app.on("before-quit", () => {
  stopBackend();
});


let isOnline = true;

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: isOnline ? "Online (Active)" : "Offline (Active)",
      submenu: [
        {
          label: "Go Online",
          click: async () => {
            isOnline = true;
            stopBackend();
            win.loadURL(BASE_URL_ONLINE);
            Menu.setApplicationMenu(buildMenu());
          }
        },
        {
          label: "Go Offline",
          click: async () => {
              try {
                isOnline = false;

                showLoader(win);   // 👈 FIRST show immediately

                setImmediate(async () => {
                  stopBackend();
                  await startBackend();
                  await waitForBackend(8088);

                  hideLoader();

                  win.loadURL("http://localhost:8088/login");
                  Menu.setApplicationMenu(buildMenu());
                });

              } catch (err) {
                console.error(err);
                hideLoader();
              }
            }
        }
      ]
    },
    {
      label: "Refresh",
      accelerator: "CmdOrCtrl+R",
      click: () => win.reload()
    },
    {
      label: "Clear Cache",
      accelerator: "CmdOrCtrl+Shift+R",
      click: async () => {
        const ses = session.defaultSession;
        await ses.clearCache();
        await ses.clearStorageData({
          storages: ["cookies", "localstorage", "indexdb", "serviceworkers"]
        });
        win.reload();
      }
    }
  ]);
}
Menu.setApplicationMenu(buildMenu());

let offlineWindow = null;

function closeOfflineWindow() {
  if (offlineWindow) {
    offlineWindow.close();
    offlineWindow = null;
  }
} 

async function isRealOnline() {
  try {
    await fetch("https://clients3.google.com/generate_204", {
      cache: "no-store",
      mode: "no-cors"
    });
    return true;
  } catch (e) {
    return false;
  }
}

function createOfflineWindow() {
  if (offlineWindow) return;

  offlineWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  offlineWindow.loadFile("offline.html");
  
}

setInterval(async () => {
  const online = await isRealOnline();

  // console.log("Internet:", online);

  if (!online) {
    createOfflineWindow();
  } else {
    closeOfflineWindow();
  }
}, 3000);



  /* ===============================
    GST PORTAL OPEN + FOCUS + FILL
  ================================= */

  ipcMain.handle("open-gst-portal", async (event, gst) => {
    if (!win) throw new Error("Main window not available");
    // Agar pehle se GST window open hai to use close karo
  if (gstWindow && !gstWindow.isDestroyed()) {
      gstWindow.close();
  }

  gstWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      parent: win,
      modal: false,
      resizable: false, 
      autoHideMenuBar: true,
      webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false
      }
  });

  gstWindow.on("closed", () => {
      gstWindow = null;
  });

  await gstWindow.loadURL("https://services.gst.gov.in/services/searchtp");
  try {
    // stop any ongoing navigation and load GST portal
    try { gstWindow.webContents.stop(); } catch (e) {}
    await gstWindow.loadURL("https://services.gst.gov.in/services/searchtp");
    const result = await gstWindow.webContents.executeJavaScript(`
      (function(){
      return new Promise((resolve, reject) => {
        try {
          const gstValue = ${JSON.stringify(gst)};
          const getText = (xpath) => {
            try {
              return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                .singleNodeValue?.innerText?.trim() || null;
            } catch (e) { return null; }
          };

          const selectors = ['#for_gstin','input[name="for_gstin"]','input[placeholder*="GSTIN"]','input[type="text"]'];
          let input = null;
          for (const s of selectors) { input = document.querySelector(s); if (input) break; }

          if (!input) {
            // observe for input for a short time
            const obsTimeout = setTimeout(() => { observer && observer.disconnect(); reject('GST input not found'); }, 15000);
            const observer = new MutationObserver(() => {
              for (const s of selectors) { input = document.querySelector(s); if (input) break; }
              if (input) { observer.disconnect(); clearTimeout(obsTimeout); fillAndWait(input); }
            });
            observer.observe(document.documentElement || document.body, { childList:true, subtree:true });
            return;
          }

          fillAndWait(input);

          function fillAndWait(inputEl) {
            try {
              inputEl.focus();
              try {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(inputEl, gstValue);
              } catch(e){}
              inputEl.value = gstValue;
              inputEl.setAttribute('value', gstValue);
              ['input','change','keyup','keydown','blur'].forEach(ev => { try { inputEl.dispatchEvent(new Event(ev, { bubbles: true })); } catch(e){} });
            } catch(e){ console.warn('fill error', e); }

            const findSearch = () => {
              const cands = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
              const byText = cands.find(el => /search|submit|find|go/i.test((el.innerText||el.value||'')));
              if (byText) return byText;
              return cands.find(el => el.offsetWidth > 0 && el.offsetHeight > 0) || null;
            };

            let btn = findSearch();
            if (btn) attach(btn);
            else {
              const btnObs = new MutationObserver(() => {
                btn = findSearch();
                if (btn) { btnObs.disconnect(); attach(btn); }
              });
              btnObs.observe(document.documentElement || document.body, { childList:true, subtree:true });
              // fallback: allow manual click and poll for results
              setTimeout(() => { if (!btn) attachManualWatcher(); }, 15000);
            }

            function attach(buttonEl) {
              const onClick = async () => {
                try {
                  // wait for results to render
                  const deadline = Date.now() + 30000;
                  let legal = null;
                  while (Date.now() < deadline) {
                    legal = document.evaluate("//strong[contains(text(),'Legal Name')]/parent::p/following-sibling::p", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (legal) break;
                    await new Promise(r => setTimeout(r, 500));
                  }
                  if (!legal) {
                    resolve({ error: 'Results not found after search' });
                    return;
                  }
                  const data = {
                    legalName: legal?.innerText?.trim() || null,
                    tradeName: getText("//strong[contains(text(),'Trade Name')]/parent::p/following-sibling::p"),
                    status: getText("//strong[contains(text(),'GSTIN / UIN')]/parent::p/following-sibling::p"),
                    principalPlace: getText("//strong[contains(text(),'Principal Place')]/parent::p/following-sibling::p")
                  };
                  resolve({ success:true, data });
                } catch(err) { resolve({ error: err && err.message ? err.message : String(err) }); }
              };
              buttonEl.addEventListener('click', onClick, { once: true });
            }

            function attachManualWatcher() {
              const timeout = Date.now() + 60000;
              const poll = setInterval(() => {
                const legal = document.evaluate("//strong[contains(text(),'Legal Name')]/parent::p/following-sibling::p", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (legal) {
                  clearInterval(poll);
                  const data = {
                    legalName: legal?.innerText?.trim() || null,
                    tradeName: getText("//strong[contains(text(),'Trade Name')]/parent::p/following-sibling::p"),
                    status: getText("//strong[contains(text(),'GSTIN / UIN')]/parent::p/following-sibling::p"),
                    principalPlace: getText("//strong[contains(text(),'Principal Place')]/parent::p/following-sibling::p")
                  };
                  resolve({ success:true, data });
                }
                if (Date.now() > timeout) { clearInterval(poll); resolve({ error: 'Timed out waiting for results' }); }
              }, 700);
            }
          } // end fillAndWait
        } catch(e) { reject(e && e.message ? e.message : String(e)); }
      });
    })()`, true);

    // result received from page
    console.log('GST portal result', result);

    if (gstWindow && !gstWindow.isDestroyed()) {
    gstWindow.close();
}

win.focus();

return result;
  } catch (err) {
    console.error('open-gst-portal error', err);
    // try to return to React UI even on error
    // try { await win.loadURL("https://cid.cg.gov.in/"); win.focus(); } catch(e){}
    throw err;
  }
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

// loader part start 

function showLoader(parentWindow = null) {
    try {

        if (loaderWindow && !loaderWindow.isDestroyed()) {
            return;
        }

        loaderWindow = new BrowserWindow({
            width: 350,
            height: 180,
            parent: parentWindow,   // win ki jagah parentWindow
            modal: !!parentWindow,
            frame: false,
            resizable: false,
            alwaysOnTop: false,
            skipTaskbar: true,
            webPreferences: {
                contextIsolation: true
            }
        });

        loaderWindow.loadFile(path.join(__dirname, "./loader.html"));

        loaderWindow.on("closed", () => {
            loaderWindow = null;
        });

    } catch (err) {
        console.error("❌ Error showing loader:", err);
    }
}

function hideLoader() {
    try {

        if (loaderWindow && !loaderWindow.isDestroyed()) {
            loaderWindow.close();
        }

        loaderWindow = null;

    } catch (err) {
        console.error("❌ Error hiding loader:", err);
    }
}
// loader part end
