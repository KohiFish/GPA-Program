const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron');
const { fetchGrades } = require('./hac');
if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 550,
        show: false,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration:true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.handle('hac:fetch', async (_event, { url, user, pass }) => {
    const ses = session.fromPartition('hac');
    return fetchGrades((u, o) => ses.fetch(u, o), url, user, pass);
});

app.whenReady().then(() => {
    createWindow();
    if (process.platform === 'darwin') {
        app.dock.hide();
    }
    const hotkey = 'CommandOrControl+Alt+1';
    const ret = globalShortcut.register(hotkey, () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
        }

        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    if (!ret) {
        console.log('Registration failed for global shortcut');
        console.log('Please return to the main menu');
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
