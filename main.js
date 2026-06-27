const { app, BrowserWindow, ipcMain, screen,Menu,session   } = require("electron");
const path = require("path");
const menu = Menu.buildFromTemplate([
  {
    label: "Online",
    submenu: [
      {
        label: "Online",
        click() {
          win.loadURL("http://localhost:8091/login");
        }
      },
      {
        label: "Offline",
        click() {
          win.loadURL("http://localhost:5173/cms-ui/");
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
      try {
        const ses = session.defaultSession;

        await ses.clearCache();
        await ses.clearStorageData({
          storages: [
            "cookies",
            "localstorage",
            "indexdb",
            "serviceworkers"
          ]
        });

        console.log("Cache Cleared");

        if (win) {
          win.reload();
        }
      } catch (err) {
        console.error("Cache clear error:", err);
      }
    }
  }
]);

Menu.setApplicationMenu(menu);

let win;
let gstWindow;

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
  win.loadURL("http://localhost:8091/addVender");
  }

  app.whenReady().then(createWindow);

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
    try { await win.loadURL("http://localhost:8091/addVender"); win.focus(); } catch(e){}
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
