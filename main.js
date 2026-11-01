const { app, BrowserWindow, globalShortcut, ipcMain, session, Tray, Menu } = require('electron');
const { fetchGrades } = require('./hac');
const main = require('electron/main');
if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow;
let tray;

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
    const ses = session.fromPartition('persist:hac');
    return fetchGrades((u, o) => ses.fetch(u, o), url, user, pass);
});
function toggleWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
}
app.whenReady().then(() => {
    createWindow();
    const { nativeImage } = require('electron');
    const iconPath = require('path').join(__dirname, 'icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Grade Menu (Ctrl+Alt+1)');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Show / Hide', click: () => toggleWindow() },
        { label: 'Quit', click: () => app.quit() }
    ]));
    if (app.isPackaged) {
        app.setLoginItemSettings({ openAtLogin: true });
    }
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

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
});