/**
 * @file Persistent project list storage (CommonJS).
 *
 * Stores the user's pinned projects in `localStorage` and notifies
 * subscribers whenever the list changes. Also migrates data from the
 * legacy `project-hub` storage key, if present.
 */

const { Emitter } = require('atom');
const path = require('path');

/** localStorage key used by this package. */
const STORAGE_KEY = 'project-pro:projects:v1';

/** Legacy key from the old "project-hub" package, migrated on first run. */
const LEGACY_KEY = 'project-hub:projects:v1';

/** Accent color palette assigned randomly to new project cards. */
const PALETTE = [
  '#7c6cff', '#00d4ff', '#ff6ec7', '#3ddc97',
  '#ffb454', '#5eead4', '#f472b6', '#a3e635'
];

/** Simple observable store for the pinned project list. */
class ProjectStore {
  constructor() {
    this.emitter = new Emitter();
    this.projects = this.load();
  }

  /**
   * Loads the project list from localStorage, migrating legacy data
   * from the old package key when necessary.
   * @returns {Array<Object>} list of project records
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) return JSON.parse(raw) || [];
      // One-time migration from the legacy "project-hub" package.
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const migrated = JSON.parse(legacy) || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  /** Persists the current list to localStorage. */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
    } catch (e) {
      // Storage may be unavailable — fail silently.
    }
  }

  /**
   * Subscribes to list changes.
   * @param {Function} callback invoked after every change
   * @returns {Disposable} unsubscribe handle
   */
  onDidChange(callback) {
    return this.emitter.on('did-change', callback);
  }

  /** Notifies all subscribers that the list changed. */
  emitChange() {
    this.emitter.emit('did-change');
  }

  /** @returns {Array<Object>} a copy of the full project list */
  getAll() {
    return [...this.projects];
  }

  /** @returns {number} number of tracked projects */
  count() {
    return this.projects.length;
  }

  /**
   * Filters projects by a search query (matches name or path).
   * @param {string} query free-text search term
   * @returns {Array<Object>} matching projects
   */
  getFiltered(query = '') {
    const q = String(query || '').trim().toLowerCase();
    const all = this.getAll();
    if (!q) return all;
    return all.filter(
      (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)
    );
  }

  /** @returns {boolean} true if the path is already tracked */
  exists(projectPath) {
    return this.projects.some((p) => p.path === projectPath);
  }

  /**
   * Adds a new project (no-op if it already exists).
   * @param {string} projectPath absolute folder path
   * @param {Object} [options] `{ silent: true }` skips the change event
   * @returns {Object|null} the created record, or null if it existed
   */
  addProject(projectPath, options = {}) {
    if (!projectPath) return null;
    projectPath = path.normalize(String(projectPath));
    if (this.exists(projectPath)) return null;

    const project = {
      path: projectPath,
      name: path.basename(projectPath) || projectPath,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)] || '#7c6cff',
      addedAt: Date.now(),
      lastOpenedAt: Date.now(),
      openCount: 0
    };

    this.projects.push(project);
    this.save();
    if (!options.silent) this.emitChange();
    return project;
  }

  /**
   * Removes a project from the list (files on disk are untouched).
   * @param {string} projectPath absolute folder path
   */
  removeProject(projectPath) {
    this.projects = this.projects.filter((p) => p.path !== projectPath);
    this.save();
    this.emitChange();
  }

  /**
   * Updates "last opened" metadata after a project is opened.
   * @param {string} projectPath absolute folder path
   */
  touchProject(projectPath) {
    const p = this.projects.find((x) => x.path === projectPath);
    if (p) {
      p.lastOpenedAt = Date.now();
      p.openCount = (p.openCount || 0) + 1;
      this.save();
      this.emitChange();
    }
  }

  /** Frees internal resources. Call on package deactivation. */
  dispose() {
    this.emitter.dispose();
  }
}

module.exports = ProjectStore;
