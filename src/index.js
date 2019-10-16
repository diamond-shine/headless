/**
 * Copyright © 2019, Bucan Befestigungstechnik AG
 *
 * MIT
 *
 * This is the entry file of headless.
 *
 * @summary Headless a place for all your backends.
 * @author Fabio Nettis
 *
 * Created at     : 2019-10-14 07:02:45
 * Last modified  : 2019-10-16 07:15:01
 */

const fs = require('fs-extra');
const path = require('path');
const electron = require('electron');

const { app } = electron;
const { shell } = electron;

const { ipcMain } = electron
const { BrowserWindow } = electron;
const SettingsHelper = require('./helpers/SettingsHelper');

/**
 * build the template paths that will be used
 * by the render process.
 */
const envs = path.join(__dirname, './pages/Environments.html');
const about = path.join(__dirname, './pages/About.html');
const addEnv = path.join(__dirname, './pages/AddEnv.html');
const manageEnv = path.join(__dirname, './pages/ManageEnv.html');
const currentEnv = path.join(__dirname, './pages/CurrentEnv.html');
const addFirstEnv = path.join(__dirname, './pages/AddFirstEnv.html');

const Headless = {
  init: async () => {
    /**
     * create the required directories/files for
     * the SettingsHelper and SettingsHelper.Docs
     * methods.
     */
    await SettingsHelper.init();

    // create a new BrowserWindow
    const browserWindow = new BrowserWindow({
      frame: false,
      height: 855,
      width: 1480,
      webPreferences: {
        nodeIntegration: true, // allows require() in html files
      },
    });

    // check if entries are present
    const isEmpty = await SettingsHelper.empty();

    if (isEmpty) {
      browserWindow.loadFile(addFirstEnv);
    } else {
      browserWindow.loadFile(currentEnv);
    }

    /**
     * called on navigation intent from render
     * process.
     */
    ipcMain.on('onNavigation', async (_, location, name) => {
      switch (location) {
        case 'manage': {
          // get the item that should be editet
          const entries = await SettingsHelper.read();
          const item = entries.find((value) => value.name === name);

          // create temporary item store
          const file = path.join(SettingsHelper.dir, 'modify.json');
          await fs.createFile(file);
          await fs.writeJSON(file, { item }, { spaces: '\t' });

          // load file and send data to render process
          await browserWindow.loadFile(manageEnv);
          browserWindow.webContents.send('onEditReceived', item);
          break;
        }

        case 'environments': {
          browserWindow.loadFile(envs);
          break;
        }

        case 'add': {
          browserWindow.loadFile(addEnv);
          break;
        }

        case 'about': {
          browserWindow.loadFile(about);
          break;
        }

        case 'help': {
          shell.openExternal('https://github.com/fabio-nettis/headless');
          break;
        }

        default: browserWindow.loadFile(currentEnv);
      }
    });

    /**
     * called on item delete
     */
    ipcMain.on('onItemRemoved', async (_, name) => {
      // delete the entry
      await SettingsHelper.delete(name);
      // check empty state
      const empty = await SettingsHelper.empty();
      await SettingsHelper.Docs.delete(name);

      if (!empty) {
        // set new active if not empty
        const entries = await SettingsHelper.read();
        const filtered = entries.filter((value) => value.active);

        // set new active item if deleted was active
        if (filtered.length === 0) {
          await SettingsHelper.set(entries[entries.length - 1].name, false);
          browserWindow.loadFile(currentEnv);
        }
      } else {
        browserWindow.loadFile(addFirstEnv);
      }
    });

    /**
     * called if the focused item in the scope
     * changes.
     */
    ipcMain.on('onActiveChanged', async (_, name) => {
      await SettingsHelper.set(name);
      browserWindow.loadFile(currentEnv);
    });

    /**
     * called when an item was added to the
     * environments.
     */
    ipcMain.on('onItemAdded', async (_, item) => {
      await SettingsHelper.add(item);
      await SettingsHelper.Docs.add(item.name, '');
      browserWindow.loadFile(currentEnv);
    });

    /**
     * called after an item was edited and
     * configures the settings accordingly.
     */
    ipcMain.on('onItemWasEdited', async (_, item) => {
      const file = path.join(SettingsHelper.dir, 'modify.json');
      const modify = await fs.readJSON(file);

      await SettingsHelper.edit(modify.item.name, item);
      await fs.unlink(file);

      /**
       * check if the items name was changed
       * while editing and set the paramter
       * in the Docs.update() function accordingly.
       */
      if (modify.item.name === item.name) {
        await SettingsHelper.Docs.update(modify.item.name, item.documentation);
      } else {
        await SettingsHelper.Docs.update(modify.item.name, item.name, true);
        await SettingsHelper.Docs.update(item.name, item.documentation);
      }

      browserWindow.loadFile(envs);
    });
  },
};

app.on('ready', Headless.init);
