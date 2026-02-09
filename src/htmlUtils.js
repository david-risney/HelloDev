// HTML utility: tagged template literal that auto-escapes interpolated values.
// Use rawHtml() to mark a value as already-safe HTML that should not be escaped.

const RAW_HTML = Symbol('rawHtml');

// Mark a string as safe HTML (will not be escaped by safeHtml)
export function rawHtml(value) {
  return { [RAW_HTML]: true, value: String(value) };
}

// Escape a string for safe insertion into HTML
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

// Tagged template literal that auto-escapes interpolated values.
// Values wrapped with rawHtml() are inserted without escaping.
export function safeHtml(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const val = values[i];
      if (val && val[RAW_HTML]) {
        result += val.value;
      } else {
        result += escapeHtml(val);
      }
    }
  }
  return result;
}
