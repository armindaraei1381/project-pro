/**
 * @file "New Project" modal dialog (CommonJS).
 *
 * Lets the user pick a project name, destination folder, starter template
 * and optional `git init`, then materializes the template on disk.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CompositeDisposable } = require('atom');
const { TEMPLATES, materialize } = require('./templates');

/** localStorage key remembering the last used destination folder. */
const LAST_LOCATION_KEY = 'project-pro:lastCreateLocation';

/** Characters that must never appear inside a project (folder) name. */
const INVALID_NAME_CHARS = /[/\\:*?"<>|]/;

/** Modal dialog for creating projects from templates. */
class CreateProjectDialog {
  /**
   * @param {Object} handlers
   * @param {Function} handlers.onCreate called with the new project path
   * @param {Function} handlers.onDidDestroy called when the dialog closes
   */
  constructor({ onCreate, onDidDestroy } = {}) {
    this.onCreate = onCreate || (() => {});
    this.onDidDestroy = onDidDestroy || (() => {});
    this.selectedTemplate = TEMPLATES[0].id;
    this.disposables = null;
    this.panel = null;
    this.element = null;
    this.destroyed = false;
    this.isCreating = false; // guards against double submission (Enter + click)
  }

  /** Builds the DOM and attaches the dialog as a modal panel. */
  attach() {
    this.build();

    this.panel = atom.workspace.addModalPanel({
      item: this.element,
      visible: true,
      priority: 150
    });

    // Support core keybindings (Esc / Enter) while the dialog has focus.
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.commands.add(this.element, {
        'core:cancel': () => this.destroy(),
        'core:confirm': () => this.create()
      })
    );

    this.nameInput = this.element.querySelector('.phd__name');
    this.locationInput = this.element.querySelector('.phd__location');

    // Pre-fill the location: last used folder, else parent of current project.
    const lastLocation = localStorage.getItem(LAST_LOCATION_KEY);
    if (lastLocation) {
      this.locationInput.value = lastLocation;
    } else if (atom.project.getPaths().length) {
      this.locationInput.value = path.dirname(atom.project.getPaths()[0]);
    }

    this.nameInput.focus();
  }

  /** Constructs the dialog DOM and wires up event listeners. */
  build() {
    this.element = document.createElement('div');
    this.element.className = 'project-pro-dialog';
    this.element.tabIndex = -1;

    const cards = TEMPLATES.map((t, i) => `
      <div class="phd__template ${i === 0 ? 'is-selected' : ''}" data-id="${t.id}" title="${t.description}">
        <div class="phd__template-icon">${t.icon}</div>
        <div class="phd__template-name">${t.name}</div>
        <div class="phd__template-desc">${t.description}</div>
      </div>
    `).join('');

    this.element.innerHTML = `
      <h2 class="phd__title">New Project</h2>

      <label class="phd__label">Project name</label>
      <input type="text" class="phd__input phd__name" placeholder="my-awesome-project" spellcheck="false" />

      <label class="phd__label">Location</label>
      <div class="phd__row">
        <input type="text" class="phd__input phd__location" placeholder="/home/you/projects" spellcheck="false" />
        <button class="phd__btn phd__browse">Browse...</button>
      </div>

      <label class="phd__label">Template</label>
      <div class="phd__templates">${cards}</div>

      <div class="phd__footer">
        <label class="phd__checkbox">
          <input type="checkbox" class="phd__git" checked />
          Initialize git repository
        </label>
        <div class="phd__actions">
          <button class="phd__btn phd__cancel">Cancel</button>
          <button class="phd__btn phd__primary phd__create">Create Project</button>
        </div>
      </div>
    `;

    // Template selection cards.
    this.element.querySelectorAll('.phd__template').forEach((el) => {
      el.addEventListener('click', () => {
        this.element.querySelectorAll('.phd__template').forEach((x) => x.classList.remove('is-selected'));
        el.classList.add('is-selected');
        this.selectedTemplate = el.dataset.id;
      });
    });

    // Native folder picker for the destination field.
    this.element.querySelector('.phd__browse').addEventListener('click', () => {
      atom.pickFolder((paths) => {
        if (paths && paths[0] && !this.destroyed) {
          this.element.querySelector('.phd__location').value = paths[0];
        }
      });
    });

    this.element.querySelector('.phd__cancel').addEventListener('click', () => this.destroy());
    this.element.querySelector('.phd__create').addEventListener('click', () => this.create());

    this.element.addEventListener('keydown', (e) => {
      if (this.destroyed) return;
      if (e.key === 'Escape') this.destroy();
    });
  }

  /** Shows a validation warning notification. */
  error(message) {
    atom.notifications.addWarning('Project Pro', { description: message });
  }

  /** Validates inputs, creates the project folder and notifies the caller. */
  create() {
    if (this.destroyed || this.isCreating) return;

    const name = this.element.querySelector('.phd__name').value.trim();
    const location = this.element.querySelector('.phd__location').value.trim();
    const gitInit = this.element.querySelector('.phd__git').checked;

    // ---------- Validation ----------
    if (!name) return this.error('Project name is required.');
    if (INVALID_NAME_CHARS.test(name)) {
      return this.error('Project name contains invalid characters ( / \\ : * ? " < > | ).');
    }
    if (!location || !fs.existsSync(location) || !fs.statSync(location).isDirectory()) {
      return this.error('Choose a valid location folder.');
    }

    const projectPath = path.join(location, name);
    if (fs.existsSync(projectPath)) {
      return this.error('"' + name + '" already exists in that location.');
    }

    const template = TEMPLATES.find((t) => t.id === this.selectedTemplate);

    this.isCreating = true;
    try {
      fs.mkdirSync(projectPath, { recursive: true });
      materialize(template, projectPath, name);

      if (gitInit) {
        try {
          execSync('git init -q', { cwd: projectPath, stdio: 'ignore' });
        } catch (e) {
          // git is not installed — silently skip initialization.
        }
      }

      localStorage.setItem(LAST_LOCATION_KEY, location);
      this.destroy();
      this.onCreate(projectPath, template);
    } catch (err) {
      this.isCreating = false;
      atom.notifications.addError('Project Pro', {
        description: String((err && err.message) || err)
      });
    }
  }

  /** Detaches the panel and cleans up all listeners. Safe to call twice. */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.disposables) {
      this.disposables.dispose();
      this.disposables = null;
    }
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
    this.onDidDestroy();
  }
}

module.exports = CreateProjectDialog;
