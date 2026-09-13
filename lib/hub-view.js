/**
 * @file The main dashboard view (CommonJS).
 */

const fs = require('fs');
const { CompositeDisposable } = require('atom');
const ProjectCard = require('./project-card');
const { pluralize } = require('./utils');

/** Themes available as clickable swatches in the header. */
const THEMES = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'match-editor', label: 'Match Pulsar' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'daylight', label: 'Daylight' },
  { id: 'mono', label: 'Mono' },
  { id: 'custom', label: 'Custom' }
];

/**
 * Resolves an absolute filesystem path from a dropped File object.
 * Newer Electron builds removed `File.path`, so fall back to
 * `webUtils.getPathForFile` when available.
 */
function getDroppedFilePath(file) {
  try {
    if (file.path) return file.path;
    const electron = require('electron');
    if (electron && electron.webUtils && typeof electron.webUtils.getPathForFile === 'function') {
      return electron.webUtils.getPathForFile(file);
    }
  } catch (err) {
    // Intentionally swallow — dropping is a convenience feature.
  }
  return null;
}

/**
 * Dashboard pane item implementing the Pulsar PaneItem protocol
 * (getElement / getURI / getTitle / serialize / destroy).
 */
class HubView {
  constructor(projectStore, { uri } = {}) {
    this.projectStore = projectStore;
    this.uri = uri || 'project-pro://hub';
    this.filterText = '';
    this.destroyed = false;
    this.disposables = new CompositeDisposable();

    // Root element; data attributes mirror package settings so the
    // stylesheet can react without re-rendering.
    this.element = document.createElement('div');
    this.element.classList.add('project-pro');
    this.element.classList.toggle('is-animated', atom.config.get('project-pro.animations') !== false);
    this.element.classList.toggle('no-swatches', atom.config.get('project-pro.showThemeSwatches') === false);
    this.element.dataset.theme = atom.config.get('project-pro.theme') || 'aurora';
    this.element.dataset.blur = atom.config.get('project-pro.blurIntensity') || 'medium';
    this.applyAccent(atom.config.get('project-pro.customAccent'));

    // Decorative background blobs.
    const aurora = document.createElement('div');
    aurora.className = 'project-pro__aurora';
    aurora.innerHTML =
      '<div class="project-pro__blob project-pro__blob--1"></div>' +
      '<div class="project-pro__blob project-pro__blob--2"></div>' +
      '<div class="project-pro__blob project-pro__blob--3"></div>';
    this.element.appendChild(aurora);

    this.content = document.createElement('div');
    this.content.className = 'project-pro__content';
    this.element.appendChild(this.content);

    // Keep the DOM in sync with every relevant package setting, live.
    this.disposables.add(
      atom.config.observe('project-pro.theme', (v) => {
        if (this.destroyed) return;
        this.element.dataset.theme = v || 'aurora';
        this.updateThemeSwatches();
        this.renderProjects();
      }),
      atom.config.observe('project-pro.customAccent', (v) => this.applyAccent(v)),
      atom.config.observe('project-pro.blurIntensity', (v) => {
        if (!this.destroyed) this.element.dataset.blur = v || 'medium';
      }),
      atom.config.observe('project-pro.ambientGlow', (v) => {
        this.element.style.setProperty('--hub-blob-opacity', String((v == null ? 50 : v) / 100));
      }),
      atom.config.observe('project-pro.fontSize', (v) => {
        this.element.style.setProperty('--hub-font-size', (v == null ? 14 : v) + 'px');
      }),
      atom.config.observe('project-pro.fontFamily', (v) => {
        this.element.style.fontFamily = v && String(v).trim() ? v : '';
      }),
      atom.config.observe('project-pro.titleFontWeight', (v) => {
        this.element.style.setProperty('--hub-title-weight', v || '600');
      }),
      atom.config.observe('project-pro.cornerRadius', (v) => {
        this.element.style.setProperty('--hub-radius', (v == null ? 18 : v) + 'px');
      }),
      atom.config.observe('project-pro.cardWidth', (v) => {
        this.element.style.setProperty('--hub-card-min', (v == null ? 280 : v) + 'px');
      }),
      atom.config.observe('project-pro.animations', (v) => {
        this.element.classList.toggle('is-animated', v !== false);
      }),
      atom.config.observe('project-pro.showThemeSwatches', (v) => {
        this.element.classList.toggle('no-swatches', v === false);
      }),
      atom.config.observe('project-pro.sortBy', () => {
        this.syncSortSelect();
        this.renderProjects();
      }),
      atom.config.observe('project-pro.coloredCards', () => this.renderProjects()),
      atom.config.observe('project-pro.showPaths', () => this.renderProjects()),
      atom.config.observe('project-pro.showStats', () => this.renderProjects())
    );

    this.render();
    this.disposables.add(this.projectStore.onDidChange(() => this.renderProjects()));

    // Accept folders dropped onto the dashboard.
    this.element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    this.element.addEventListener('drop', (e) => this.handleDrop(e));
  }

  /** Handles folders dropped onto the dashboard (defensively). */
  handleDrop(event) {
    event.preventDefault();
    if (this.destroyed || !this.projectStore) return;

    try {
      const files = (event.dataTransfer && event.dataTransfer.files) || [];
      for (const file of files) {
        const p = getDroppedFilePath(file);
        if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          this.projectStore.addProject(p);
        }
      }
    } catch (err) {
      atom.notifications.addWarning('Project Pro', {
        description: 'Could not read the dropped folder.'
      });
    }
  }

  /** Applies the custom accent color as a CSS variable. */
  applyAccent(value) {
    if (!value || this.destroyed) return;
    const hex = typeof value.toHexString === 'function' ? value.toHexString() : String(value);
    this.element.style.setProperty('--hub-accent', hex);
  }

  // ---------- PaneItem protocol ----------

  getElement() { return this.element; }
  getURI() { return this.uri; }
  getTitle() { return 'Project Pro'; }
  getIconName() { return 'home'; }
  serialize() { return { deserializer: 'ProjectProView' }; }

  destroy() {
    this.destroyed = true;
    if (this.disposables) {
      this.disposables.dispose();
      this.disposables = null;
    }
    if (this.element && this.element.parentNode) this.element.remove();
  }

  // ---------- Helpers ----------

  /** Dispatches a workspace command programmatically. */
  dispatchCommand(command) {
    atom.commands.dispatch(atom.views.getView(atom.workspace), command);
  }

  /** Returns the filtered + sorted project list. */
  getVisibleProjects() {
    const list = this.projectStore.getFiltered(this.filterText);
    const mode = atom.config.get('project-pro.sortBy') || 'recent';
    const arr = [...list];
    if (mode === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (mode === 'opened') arr.sort((a, b) => (b.openCount || 0) - (a.openCount || 0));
    else arr.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
    return arr;
  }

  // ---------- Rendering ----------

  /** Builds the static layout (header + grid container) once. */
  render() {
    const swatches = THEMES.map(
      (t) => '<button class="project-pro__theme-swatch" data-swatch="' + t.id + '" title="' + t.label + '"></button>'
    ).join('');

    this.content.innerHTML = `
      <header class="project-pro__header">
        <div class="project-pro__heading">
          <h1 class="project-pro__title">Project Pro</h1>
          <p class="project-pro__subtitle"></p>
          <div class="project-pro__themes">${swatches}</div>
        </div>
        <div class="project-pro__actions">
          <input type="text" class="project-pro__search" placeholder="Search..." spellcheck="false" />
          <select class="project-pro__sort" title="Sort projects">
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="opened">Most opened</option>
          </select>
          <button class="project-pro__btn project-pro__btn--icon" data-action="settings" title="Package settings">⚙</button>
          <button class="project-pro__btn" data-action="add">Add Folder</button>
          <button class="project-pro__btn project-pro__btn--primary" data-action="new">＋ New Project</button>
        </div>
      </header>
      <div class="project-pro__grid"></div>
    `;

    // Debounce the search box so typing stays smooth.
    let searchTimer = null;
    this.content.querySelector('.project-pro__search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.filterText = e.target.value || '';
        this.renderProjects();
      }, 120);
    });

    this.content.querySelector('.project-pro__sort').addEventListener('change', (e) => {
      atom.config.set('project-pro.sortBy', e.target.value);
    });
    this.syncSortSelect();

    this.content.querySelector('[data-action="settings"]').addEventListener('click', () => {
      atom.workspace.open('atom://config/packages/project-pro');
    });
    this.content.querySelector('[data-action="add"]').addEventListener('click', () =>
      this.dispatchCommand('project-pro:add-project')
    );
    this.content.querySelector('[data-action="new"]').addEventListener('click', () =>
      this.dispatchCommand('project-pro:new-project')
    );

    this.content.querySelectorAll('.project-pro__theme-swatch').forEach((btn) => {
      btn.addEventListener('click', () => atom.config.set('project-pro.theme', btn.dataset.swatch));
    });

    this.updateThemeSwatches();
    this.grid = this.content.querySelector('.project-pro__grid');
    this.renderProjects();
  }

  /** Mirrors the `sortBy` setting into the header select element. */
  syncSortSelect() {
    const select = this.content && this.content.querySelector('.project-pro__sort');
    if (select) select.value = atom.config.get('project-pro.sortBy') || 'recent';
  }

  /** Highlights the swatch matching the active theme. */
  updateThemeSwatches() {
    if (!this.content || this.destroyed) return;
    const current = this.element.dataset.theme;
    this.content.querySelectorAll('.project-pro__theme-swatch').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.swatch === current);
    });
  }

  /** Re-renders the project card grid and the subtitle counter. */
  renderProjects() {
    if (!this.grid || this.destroyed) return;

    const subtitle = this.content.querySelector('.project-pro__subtitle');
    const count = this.projectStore.count();
    if (subtitle) subtitle.textContent = count + ' ' + pluralize('project', count);

    this.grid.innerHTML = '';
    const projects = this.getVisibleProjects();

    // Empty state (no projects, or no search matches).
    if (!projects.length) {
      const empty = document.createElement('div');
      empty.className = 'project-pro__empty';

      if (this.filterText) {
        empty.innerHTML =
          '<div class="project-pro__empty-glyph">🔍</div><h2>No matches</h2><p>Try a different search.</p>';
      } else {
        empty.innerHTML = `
          <div class="project-pro__empty-glyph">⌘</div>
          <h2>No projects yet</h2>
          <p>Create one from a template or pin an existing folder.</p>
          <div class="project-pro__empty-actions">
            <button class="project-pro__btn project-pro__btn--primary" data-action="new">＋ New Project</button>
            <button class="project-pro__btn" data-action="add">Add Folder</button>
          </div>
        `;
        empty.querySelector('[data-action="new"]').addEventListener('click', () =>
          this.dispatchCommand('project-pro:new-project')
        );
        empty.querySelector('[data-action="add"]').addEventListener('click', () =>
          this.dispatchCommand('project-pro:add-project')
        );
      }

      this.grid.appendChild(empty);
      return;
    }

    // Card options derived from the current settings.
    const cardOptions = {
      colored: atom.config.get('project-pro.coloredCards') !== false && this.element.dataset.theme !== 'mono',
      showPath: atom.config.get('project-pro.showPaths') !== false,
      showStats: atom.config.get('project-pro.showStats') !== false,
      onOpen: (project) => this.openProject(project),
      onRemove: (project) => this.removeProject(project)
    };

    for (const project of projects) {
      this.grid.appendChild(new ProjectCard(project, cardOptions).element);
    }
  }

  /** Opens a project and records the "last opened" metadata. */
  openProject(project) {
    if (!project || !project.path) return;
    this.projectStore.touchProject(project.path);

    try {
      if (atom.config.get('project-pro.openInNewWindow')) {
        atom.open({ pathsToOpen: [project.path], newWindow: true });
      } else if (!atom.project.getPaths().includes(project.path)) {
        atom.project.addPath(project.path);
      }
    } catch (err) {
      atom.notifications.addError('Project Pro', {
        description: 'Failed to open "' + project.name + '": ' + String((err && err.message) || err)
      });
    }
  }

  /** Removes a project from the list, asking for confirmation if enabled. */
  removeProject(project) {
    if (!atom.config.get('project-pro.confirmRemoval')) {
      this.projectStore.removeProject(project.path);
      return;
    }
    atom.confirm({
      message: 'Remove "' + project.name + '" from the list?',
      detailedMessage: 'This only removes the shortcut — your files stay untouched.',
      buttons: ['Remove', 'Cancel']
    }, (response) => {
      if (response === 0) this.projectStore.removeProject(project.path);
    });
  }
}

module.exports = HubView;
