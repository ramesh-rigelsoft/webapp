const { spawn, exec } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { app,BrowserWindow  } = require("electron");

const PORT = 8088;

let backendProcess = null;
let isStarting = false;

/* ===============================
   KILL PORT
================================= */
function killPort(port) {
  try {
  return new Promise((resolve) => {
    let cmd;

    if (process.platform === "win32") {
      cmd = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`;
    } else {
      cmd = `lsof -ti:${port} | xargs kill -9`;
    }

    exec(cmd, () => resolve());
  });
}catch(err){
  
}
}

/* ===============================
   WAIT FOR BACKEND READY
================================= */
function waitForPort(port, timeout = 60000) {
  return new Promise((resolve, reject) => {

    const start = Date.now();

    function tryConnect() {
      const socket = net.createConnection(port, "127.0.0.1");

      socket.setTimeout(2000);

      socket.on("connect", () => {
        socket.destroy();
        console.log("✅ Backend Ready on port", port);
        resolve();
      });

      socket.on("timeout", () => {
        socket.destroy();
        retry();
      });

      socket.on("error", () => {
        socket.destroy();
        retry();
      });
    }

    function retry() {
      // ⛔ timeout check
      if (Date.now() - start > timeout) {
        reject(new Error("❌ Backend start timeout"));
        return;
      }

      setTimeout(tryConnect, 1000);
    }

    // 🔥 NEW LOGIC: quick pre-check
    const testSocket = net.createConnection(port, "127.0.0.1");

    testSocket.setTimeout(1000);

    testSocket.on("connect", () => {
      testSocket.destroy();
      console.log("⚡ Port already active, backend ready");
      resolve();
    });

    testSocket.on("error", () => {
      testSocket.destroy();

      // ⚡ NEW: if port is free, we don't immediately fail
      console.log("ℹ️ Port is free, waiting for backend to start...");
      setTimeout(tryConnect, 1000);
    });

    testSocket.on("timeout", () => {
      testSocket.destroy();
      setTimeout(tryConnect, 1000);
    });

  });
}

/* ===============================
   START BACKEND
================================= */
async function startBackend() {

  if (backendProcess || isStarting) {
    console.log("⚠️ Backend already running or starting...");
    return;
  }

  isStarting = true;

  try {

    await killPort(PORT);

    const jarPath = app.isPackaged
      ? path.join(process.resourcesPath, "backend", "app-backend.jar")
      : path.join(__dirname, "app-backend.jar"); // dev path

    console.log("📦 Jar Path:", jarPath);

    if (!fs.existsSync(jarPath)) {
      throw new Error("❌ JAR file not found: " + jarPath);
    }

    backendProcess = spawn("java", ["-jar", jarPath], {
      windowsHide: true,
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    backendProcess.stdout.on("data", (data) => {
      console.log("[JAVA]", data.toString());
    });

    backendProcess.stderr.on("data", (data) => {
      console.error("[JAVA ERROR]", data.toString());
    });

    backendProcess.on("close", (code) => {
      console.log("⚠️ Backend exited with code:", code);
      backendProcess = null;
    });

    backendProcess.on("error", (err) => {
      console.error("❌ Failed to start Java:", err);
    });

    await waitForPort(PORT);

  } finally {
    isStarting = false;
  }
}

/* ===============================
   STOP BACKEND
================================= */
function stopBackend() {

  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    console.log("🛑 Backend Stopped");
  }

}

function waitForBackend(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      const socket = net.createConnection(port, "127.0.0.1");

      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();

        if (Date.now() - start > timeout) {
          reject(new Error("Backend timeout"));
        } else {
          setTimeout(check, 1000);
        }
      });
    }

    check();
  });
}

/* ===============================
   EXPORT
================================= */
module.exports = {
  startBackend,
  stopBackend,
  waitForBackend
};