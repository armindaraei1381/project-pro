/**
 * @file Small shared utility helpers (CommonJS).
 */

const path = require('path');

/** Escapes a string for safe interpolation into HTML. */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formats a timestamp as a short human-readable relative date. */
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const day = 24 * 60 * 60 * 1000;

  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < day) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 7 * day) return Math.floor(diff / day) + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

/** Shortens a filesystem path to its last N segments for display. */
function shortenPath(fullPath, maxSegments = 3) {
  const sep = path.sep;
  const parts = fullPath.split(sep).filter(Boolean);
  if (parts.length <= maxSegments) return fullPath;
  return '…' + sep + parts.slice(-maxSegments).join(sep);
}

/** Naive English pluralization. */
function pluralize(word, count) {
  return count === 1 ? word : word + 's';
}

module.exports = { escapeHtml, formatDate, shortenPath, pluralize };
