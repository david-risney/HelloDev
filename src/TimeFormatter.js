/**
 * Utility class for formatting time values.
 */
export class TimeFormatter {
  /**
   * Format a date/timestamp as a relative time string (e.g., "5 minutes ago", "2 days ago").
   * @param {Date|number|string} date - Date object, timestamp in ms, or date string
   * @returns {string} Relative time string, or empty string if invalid
   */
  static formatRelative(date) {
    if (!date) return '';
    
    const timestamp = date instanceof Date ? date.getTime() : 
                      typeof date === 'number' ? date : 
                      new Date(date).getTime();
    
    if (isNaN(timestamp)) return '';
    
    const now = Date.now();
    const diffMs = now - timestamp;
    
    // Handle future dates
    if (diffMs < 0) return 'just now';
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }

  /**
   * Format a date/timestamp as a short absolute string (e.g., "12-25-2026 3:42pm").
   * @param {Date|number|string} date - Date object, timestamp in ms, or date string
   * @returns {string} Formatted date string, or empty string if invalid
   */
  static formatAbsoluteShort(date) {
    if (!date) return '';

    const d = date instanceof Date ? date :
              typeof date === 'number' ? new Date(date) :
              new Date(date);

    if (isNaN(d.getTime())) return '';

    const month = d.getMonth() + 1;
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;

    return `${month}-${day}-${year} ${hours}:${minutes}${ampm}`;
  }
}
