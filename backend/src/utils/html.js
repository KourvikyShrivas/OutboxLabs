const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Plain text -> safe HTML (keeps line breaks).
const textToHtml = (text) => `<div style="font-family:Arial,sans-serif;line-height:1.5">${escapeHtml(text).replace(/\r?\n/g, '<br>')}</div>`;

module.exports = { escapeHtml, textToHtml };
