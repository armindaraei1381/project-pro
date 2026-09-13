/**
 * @file A single project card in the dashboard grid (CommonJS).
 */

const { escapeHtml, formatDate, shortenPath } = require('./utils');

/**
 * Renders one project as a clickable glass card.
 * Clicking the card opens the project; the ✕ button removes it.
 */
class ProjectCard {
  /**
   * @param {Object} project project record from the store
   * @param {Object} options
   * @param {boolean} [options.colored=true] show the card's accent color
   * @param {boolean} [options.showPath=true] render the path line
   * @param {boolean} [options.showStats=true] render the "opened" stats line
   * @param {Function} options.onOpen invoked when the card is clicked
   * @param {Function} options.onRemove invoked when ✕ is clicked
   */
  constructor(project, options = {}) {
    this.project = project;
    this.options = options;
    const colored = options.colored !== false;

    this.element = document.createElement('div');
    this.element.className = 'project-pro__card' + (colored ? '' : ' is-monochrome');
    this.element.title = project.path;

    // Accent strip and dot use the card's own color; inline styles keep
    // the stylesheet free of per-project rules.
    const accentStyle = colored ? ' style="background:' + project.color + '"' : '';
    const dotStyle = colored ? ' style="background:' + project.color + '"' : '';
    const pathHtml = options.showPath !== false
      ? '<div class="project-pro__card-path">' + escapeHtml(shortenPath(project.path)) + '</div>'
      : '';
    const statsHtml = options.showStats !== false
      ? '<span class="project-pro__card-meta">Opened ' + formatDate(project.lastOpenedAt) +
        (project.openCount ? ' · ' + project.openCount + '×' : '') + '</span>'
      : '<span></span>';

    this.element.innerHTML = `
      <div class="project-pro__card-accent"${accentStyle}></div>
      <div class="project-pro__card-top">
        <span class="project-pro__card-dot"${dotStyle}></span>
        <span class="project-pro__card-name">${escapeHtml(project.name)}</span>
        <button class="project-pro__card-remove" title="Remove from list">✕</button>
      </div>
      ${pathHtml}
      <div class="project-pro__card-bottom">
        ${statsHtml}
        <span class="project-pro__card-open">Open →</span>
      </div>
    `;

    this.element.addEventListener('click', (e) => {
      if (e.target.closest('.project-pro__card-remove')) {
        if (this.options.onRemove) this.options.onRemove(this.project);
        return;
      }
      if (this.options.onOpen) this.options.onOpen(this.project);
    });
  }
}

module.exports = ProjectCard;
