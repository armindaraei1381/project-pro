/**
 * @file Project Pro — package entry point.
 *
 * Written in plain CommonJS on purpose: it runs natively inside Pulsar's
 * Node runtime without relying on Babel transpilation of ES modules.
 *
 * Responsibilities:
 *  - Register the workspace opener so the dashboard can be opened by URI.
 *  - Register all package commands (toggle, new project, add folder, ...).
 *  - Handle automatic launch behavior when Pulsar starts.
 *  - Manage the lifecycle of the store, dashboard view and dialogs.
 */

const { CompositeDisposable } = require('atom');
const HubView = require('./hub-view');
const ProjectStore = require('./project-store');
const CreateProjectDialog = require('./create-project-dialog');

/** URI used by the workspace opener to identify the dashboard pane item. */
const HUB_URI = 'project-pro://hub';

/** Order used by the `cycle-theme` command to rotate through themes. */
const THEME_ORDER = ['aurora', 'match-editor', 'midnight', 'daylight', 'mono', 'custom'];

module.exports = {
  subscriptions: null,
  hubView: null,
  projectStore: null,
  createDialog: null,

  /** Called by Pulsar when the package is activated. */
  activate() {
    // Guard against double activation (e.g. dev mode + normal reload).
    if (this.hubView) return;

    this.projectStore = new ProjectStore();
    this.hubView = new HubView(this.projectStore, { uri: HUB_URI });
    this.subscriptions = new CompositeDisposable();

    // Open the dashboard whenever its URI is requested.
    this.subscriptions.add(
      atom.workspace.addOpener((uri) => (uri === HUB_URI ? this.hubView : undefined))
    );

    // Register package commands on the workspace.
    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        'project-pro:toggle': () => this.toggle(),
        'project-pro:open': () => this.open(),
        'project-pro:add-project': () => this.addProjectDialog(),
        'project-pro:add-current': () => this.addCurrentProject(),
        'project-pro:new-project': () => this.showCreateDialog(),
        'project-pro:cycle-theme': () => this.cycleTheme()
      })
    );

    // Optionally track every folder opened into the current window.
    if (atom.config.get('project-pro.autoTrack')) {
      this.subscriptions.add(
        atom.project.onDidChangePaths((paths) => {
          paths.forEach((p) => this.projectStore.addProject(p, { silent: true }));
          this.projectStore.emitChange();
        })
      );
    }

    this.handleStartup();
  },

  /**
   * Decides whether the dashboard should open automatically on startup,
   * based on the `onLaunch` setting.
   *
   * Modes: "always" | "empty" | "never".
   */
  handleStartup() {
    const onLaunch = atom.config.get('project-pro.onLaunch') || 'always';
    if (onLaunch === 'never') return;

    if (onLaunch === 'always') {
      setTimeout(() => this.open(), 100);
      return;
    }

    // "empty" mode: give session restore a brief window; if nothing was
    // restored into the workspace, show the dashboard.
    let decided = false;
    let sub = null;
    const decide = () => {
      if (decided) return;
      decided = true;
      if (sub) sub.dispose();
      if (atom.workspace.getPaneItems().length === 0) this.open();
    };
    sub = atom.workspace.onDidAddPaneItem(decide);
    setTimeout(decide, 700);
  },

  /** Called by Pulsar when the package is deactivated. Tears everything down. */
  deactivate() {
    if (this.subscriptions) {
      this.subscriptions.dispose();
      this.subscriptions = null;
    }
    if (this.createDialog) {
      this.createDialog.destroy();
      this.createDialog = null;
    }
    if (this.hubView) {
      const pane = atom.workspace.paneForItem(this.hubView);
      if (pane) pane.destroyItem(this.hubView, true);
      this.hubView = null;
    }
    if (this.projectStore) {
      this.projectStore.dispose();
      this.projectStore = null;
    }
  },

  /**
   * Deserializer hook (declared in package.json) used to restore the
   * dashboard tab across window reloads.
   */
  deserializeProjectProView() {
    return this.hubView || null;
  },

  /** Opens the dashboard, or closes it if it is already open. */
  toggle() {
    const pane = atom.workspace.paneForURI(HUB_URI);
    if (pane) {
      const item = pane.itemForURI(HUB_URI);
      if (item) pane.removeItem(item);
    } else {
      this.open();
    }
  },

  /** Opens (or focuses) the dashboard pane item. */
  open() {
    atom.workspace.open(HUB_URI, { activatePane: true, activateItem: true });
  },

  /** Shows a native folder picker and adds the selected folders. */
  addProjectDialog() {
    atom.pickFolder((paths) => {
      if (!paths) return;
      paths.forEach((p) => this.projectStore.addProject(p));
    });
  },

  /** Adds the folder(s) currently open in this window to the dashboard. */
  addCurrentProject() {
    const paths = atom.project.getPaths();
    if (!paths.length) {
      atom.notifications.addWarning('Project Pro', {
        description: 'There is no open project to add.'
      });
      return;
    }
    paths.forEach((p) => this.projectStore.addProject(p));
  },

  /** Opens the "New Project from template" modal dialog. */
  showCreateDialog() {
    if (this.createDialog) return; // one dialog at a time
    this.createDialog = new CreateProjectDialog({
      onCreate: (projectPath) => {
        this.projectStore.addProject(projectPath);
        atom.notifications.addSuccess('Project Pro', {
          description: 'Project created at ' + projectPath
        });
        if (atom.config.get('project-pro.openAfterCreate')) {
          this.projectStore.touchProject(projectPath);
          this.launchProject(projectPath);
        }
      },
      onDidDestroy: () => { this.createDialog = null; }
    });
    this.createDialog.attach();
  },

  /**
   * Opens a project path either in a new window or in the current one,
   * depending on the `openInNewWindow` setting.
   */
  launchProject(projectPath) {
    try {
      if (atom.config.get('project-pro.openInNewWindow')) {
        atom.open({ pathsToOpen: [projectPath], newWindow: true });
      } else if (!atom.project.getPaths().includes(projectPath)) {
        atom.project.addPath(projectPath);
      }
    } catch (err) {
      atom.notifications.addError('Project Pro', {
        description: 'Failed to open project: ' + String((err && err.message) || err)
      });
    }
  },

  /** Rotates to the next theme in order and persists it. */
  cycleTheme() {
    const current = atom.config.get('project-pro.theme') || 'aurora';
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    atom.config.set('project-pro.theme', next);
    atom.notifications.addInfo('Project Pro', { description: 'Theme: ' + next });
  }
};
