const { app, BrowserWindow, globalShortcut } = require('electron');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 200,
        height: 350,
        show: false,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration:true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('blur', () => {
        mainWindow.hide();
    });
}

app.whenReady().then(() => { 
    createWindow();

    const hotkey = process.platform ==='darwin'?'Command+Alt+1':'Ctrl+Alt+1';
    const ret = globalShortcut.register(hotkey, () => {
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
})
