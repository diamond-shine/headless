/**
 * @description
 * Helper for interactions with the
 * environments.json file.
 */

const path = require('path');
const fs = require('fs-extra');

const SettingsHelper = {
  file: '../data/settings/environments.json',
  dir: '../data',

  // added documentation methods
  Docs: {
    file: '../data/docs/documentations.json',
    dir: '../data/docs',

    /**
   * @returns {Promise<[{ name: String, content: String, createdAt: Date, updatedAt: Date }]>}
   * Returns the contents of the environments file.
   */
    read: async () => {
      const data = await fs.readJSON(SettingsHelper.Docs.file);
      return data.documentations;
    },

    /**
     * @param {String} name
     * The name of the environment the
     * documentation belongs to.
     * @param {String} documentation
     * The markdown String for the
     * documentation.
     */
    add: async (name, documentation) => {
      // check for missing values
      if (!name) {
        throw new Error('Paramter "name" cannot be empty.');
      }

      const entries = await SettingsHelper.Docs.read();
      const found = entries.find((value) => value.name === name);

      if (found) {
        throw new Error('There is a limitation to one documentation per environment.');
      }

      // create timestamp
      const stamp = new Date();

      entries.push({
        name,
        documentation,
        createdAt: stamp,
        updatedAt: stamp,
      });

      await fs.writeJSON(SettingsHelper.Docs.file, {
        documentations: entries,
      }, {
        spaces: '\t',
      });
    },

    update: async (name, documentation, nameChange = false) => {
      // check for missing values
      if (!name) {
        throw new Error('Paramter "name" cannot be empty.');
      }

      const entries = await SettingsHelper.Docs.read();
      const updatedEntries = entries.filter((value) => value.name !== name);
      const found = entries.find((value) => value.name === name);

      if (updatedEntries.find((value) => value.name === name)) {
        throw new Error('Paramter "name" has to be unique.');
      }

      updatedEntries.push({
        name: nameChange ? documentation : found.name,
        documentation: nameChange ? found.content : documentation,
        updatedAt: new Date(),
        createdAt: found.createdAt,
      });

      await fs.writeJSON(SettingsHelper.Docs.file, {
        documentations: updatedEntries,
      }, {
        spaces: '\t',
      });
    },

    delete: async (name) => {
      const entries = await SettingsHelper.Docs.read();
      const updated = entries.filter((value) => value.name !== name);
      await fs.writeJSON(SettingsHelper.Docs.file, { documentations: updated }, { spaces: '\t' });
    },
  },

  /**
   * @description
   * Creates the environment.json file
   * if it's not already present.
   */
  init: async () => {
    const exists = await fs.exists(SettingsHelper.dir);
    if (!exists) {
      // create datastore
      await fs.mkdir(SettingsHelper.dir);
      await fs.createFile(SettingsHelper.file);
      await fs.writeJSON(SettingsHelper.file, { environments: [] }, { spaces: '\t' });

      // create docs
      await fs.mkdir(SettingsHelper.Docs.dir);
      await fs.createFile(SettingsHelper.Docs.file);
      await fs.writeJSON(SettingsHelper.Docs.file, { documentations: [] }, { spaces: '\t' });

      // remove modify.json
      const modifyPath = path.join(SettingsHelper.dir, 'modify.json');
      const modifyExists = await fs.exists(modifyPath);

      if (modifyExists) {
        await fs.unlink(modifyPath);
      }
    }
  },

  /**
   * @param {String} url
   * The url of the environment
   * @param {String} name
   * The name for the environment
   * @param {Boolean} active
   * If the environment is the currently selected
   * @returns {Promise<{ url: String, name: String, active: Boolean }>}
   * Returns the created entry
   */
  add: async ({ url = null, name = null, active = false }) => {
    // validate paramters
    if (!url) {
      throw new Error('Paramter "url" cannot be empty.');
    }

    if (!SettingsHelper.isUrl(url)) {
      throw new Error('The given url is invalid.');
    }

    if (!name) {
      throw new Error('Paramter "name" cannot be empty.');
    }

    let entries = await SettingsHelper.read();

    // check for duplicates
    const hasDuplicates = entries.filter(
      (value) => (
        value.url === url || value.name === name
      ),
    ).length > 0;

    if (hasDuplicates) {
      throw new Error('Function add expects entries to be unique.');
    }

    // update active state
    if (active && entries.length > 0) {
      entries = await SettingsHelper.unset();
    }

    // add the entry to the dataset
    const newEntry = {
      name,
      url,
      active,
      description: null,
    };

    entries.push(newEntry);
    await fs.writeJSON(SettingsHelper.file, { environments: entries }, { spaces: '\t' });

    return newEntry;
  },

  /**
   * @returns {Promise<[{ url: String, name: String, active: Boolean }]>}
   * Returns the contents of the environments file.
   */
  read: async () => {
    const data = await fs.readJSON(SettingsHelper.file);
    return data.environments;
  },

  /**
   * @param {String} searchName
   * The name of the environment
   * @param {{ url: String, name: String, active: Boolean }} update
   * The update for the environment.
   * @param {String} update.url
   * The url of the environment
   * @param {String} update.name
   * The name for the environment
   * @param {String} update.description
   * The description for the environment
   * @param {Boolean} update.active
   * If the environment is the currently selected
   * @returns {Promise<{ url: String, name: String, active: Boolean }>}
   * Returns the updated entry
   */
  update: async (searchName, update) => {
    const {
      name = null,
      url = null,
      active = null,
      description = null,
    } = update;

    // validate paramters
    if (!url && !name && active === null) {
      throw new Error('Please provide one of the paramters "url", "name" or "active".');
    }

    if (url && !SettingsHelper.isUrl(url)) {
      throw new Error('The given url is invalid.');
    }

    // get current dataset and remove searchName
    const entries = await SettingsHelper.read();

    // check for duplicates
    const hasDuplicates = entries.filter(
      (value) => (
        value.url === url || value.name === name
      ),
    ).length > 0;

    if (hasDuplicates) {
      throw new Error('Function update expects entries to be unique.');
    }

    // add entry
    entries.push({
      name,
      url,
      active,
      description,
    });

    await fs.writeJSON(SettingsHelper.file, { environments: entries }, { spaces: '\t' });

    return entries;
  },

  /**
   * @param {String} name
   * The name of the environment
   * @returns {Promise<{ url: String, name: String, active: Boolean }>}
   * Returns the deleted entry
   */
  delete: async (name) => {
    if (!name) {
      throw new Error('Paramter "name" cannot be empty.');
    }

    const entries = await SettingsHelper.read();

    // sort entries
    entries.sort((x, y) => {
      if (x === y) {
        return 0;
      } if (x) {
        return -1;
      }

      return 1;
    });

    const entry = entries.find((value) => value.name === name);
    const updated = entries.filter((value) => value.name !== name);

    await fs.writeJSON(SettingsHelper.file, { environments: updated }, { spaces: '\t' });
    return entry;
  },

  /**
   * @returns {Promise<{ url: String, name: String, active: Boolean }>}
   * Returns the currently active element
   */
  active: async () => {
    const entries = await SettingsHelper.read();
    const active = entries.find((value) => value.active);
    return active;
  },

  /**
   * @param {String} url
   * The url to be validated
   * @returns {Boolean}
   * Returns true if valid false if not.
   */
  isUrl: (url) => {
    const pattern = new RegExp('^(https?:\\/\\/)?' // protocol
      + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' // domain name
      + '((\\d{1,3}\\.){3}\\d{1,3}))' // IP (V4) address
      + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' // port
      + '(\\?[;&amp;a-z\\d%_.~+=-]*)?' // query string
      + '(\\#[-a-z\\d_]*)?$', 'i');

    if (pattern.test(url)) {
      return true;
    }

    return false;
  },

  /**
   * @returns {Promise<[{ url: String, name: String, active: Boolean }]>}
   * Returns the updated dataset
   */
  unset: async () => {
    // get current data
    const entries = await SettingsHelper.read();
    const active = await SettingsHelper.active();

    // create updated array
    active.active = false;
    const data = [...entries.filter((value) => !value.active), active];

    await fs.writeJSON(SettingsHelper.file, { environments: data }, { spaces: '\t' });
    return data;
  },

  /**
   * @returns {Boolean}
   * Returns if the dataset has entries
   */
  empty: async () => {
    const entries = await SettingsHelper.read();
    return entries.length === 0;
  },

  /**
   * @param {String} name
   * The name of the environment
   * @param {Boolean} unset
   * Decides if the unset() or read() function is called when executed
   */
  set: async (name, unset = true) => {
    let unsetEntries = null;

    if (unset) {
      unsetEntries = await SettingsHelper.unset();
    } else {
      unsetEntries = await SettingsHelper.read();
    }

    const foundItem = unsetEntries.find((value) => value.name === name);
    foundItem.active = true;

    const setEntries = unsetEntries.filter((value) => value.name !== name);
    setEntries.push(foundItem);

    await fs.writeJSON(SettingsHelper.file, { environments: setEntries }, { spaces: '\t' });
    return foundItem;
  },

  /**
   * @param {String} name
   * The original name of the environment
   * @param {{ name: String, url: String, description: String }} edit
   * The edited environment
   * @param {String} edit.name
   * The new name for the environment
   * @param {String} edit.url
   * The new url for the environment
   * @param {String} edit.description
   * The new url for the environment
   */
  edit: async (name, edit) => {
    const oldEntries = await SettingsHelper.read();
    const oldItem = oldEntries.find((value) => value.name === name);

    // new edited item
    const newItem = {
      name: edit.name,
      url: edit.url,
      active: oldItem.active,
      description: edit.description,
    };

    await SettingsHelper.delete(name);
    const newEntries = await SettingsHelper.read();
    newEntries.push(newItem);

    await fs.writeJSON(SettingsHelper.file, { environments: newEntries }, { spaces: '\t' });
  },
};

module.exports = SettingsHelper;
