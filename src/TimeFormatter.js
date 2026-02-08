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
   * Format a date/timestamp as a short relative time (e.g., "5m", "2d", "1y").
   * @param {Date|number|string} date - Date object, timestamp in ms, or date string
   * @returns {string} Short relative time string, or empty string if invalid
   */
  static formatRelativeShort(date) {
    if (!date) return '';
    
    const timestamp = date instanceof Date ? date.getTime() : 
                      typeof date === 'number' ? date : 
                      new Date(date).getTime();
    
    if (isNaN(timestamp)) return '';
    
    const now = Date.now();
    const diffMs = now - timestamp;
    
    if (diffMs < 0) return 'now';
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  }
}
