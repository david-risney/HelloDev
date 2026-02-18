import { WidgetBase } from './WidgetBase.js';
import { GraphAuthHelper } from '../GraphAuthHelper.js';
import { TimeFormatter } from '../TimeFormatter.js';

/**
 * Outlook Calendar widget.
 * Shows today's remaining agenda via Microsoft Graph API.
 */
export class CalendarWidget extends WidgetBase {
  static metadata = {
    name: 'Calendar',
    icon: '📅',
    defaultSize: { width: 4, height: 4 }
  };

  constructor(config) {
    super({ ...config, type: 'calendar' });
    this.events = [];
    this.loading = false;
    this.loadingStatus = '';
    this.error = null;
    this.errorDialogOpen = false;
    this.lastFetched = null;
    this.intervalId = null;

    this.data.refreshInterval ??= 15;
    this.data.maxItems ??= 20;
    this.data.title ??= '';

    this.restoreFromCache();
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfigSchema() {
    return [
      { key: 'title', label: 'Widget Title (optional)', type: 'string', default: '' },
      { key: 'maxItems', label: 'Max Events to Show', type: 'number', default: 20 },
      { key: 'refreshInterval', label: 'Auto Refresh (minutes, 0 = disabled)', type: 'number', default: 15 }
    ];
  }

  setConfig(values) {
    super.setConfig(values);
    this.events = [];
    this.lastFetched = null;
    localStorage.removeItem(this.getCacheKey());
    if (this.element) this.refresh();
  }

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  getCacheKey() {
    return `calendar_cache_${this.id}`;
  }

  restoreFromCache() {
    try {
      const cached = localStorage.getItem(this.getCacheKey());
      if (cached) {
        const data = JSON.parse(cached);
        if (Array.isArray(data.events)) {
          this.events = data.events;
          this.lastFetched = data.lastFetched || null;
        }
      }
    } catch (e) {
      console.error('[CalendarWidget] Cache restore error:', e);
    }
  }

  saveToCache() {
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify({
        events: this.events,
        lastFetched: this.lastFetched
      }));
    } catch (e) {
      console.error('[CalendarWidget] Cache save error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  async refresh() {
    if (this.loading) return;

    this.loading = true;
    this.loadingStatus = 'Obtaining access token...';
    this.error = null;
    this.updateContent();

    try {
      let accessToken = await GraphAuthHelper.getToken();

      this.loadingStatus = 'Fetching calendar events...';
      this.updateContent();

      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        startDateTime: now.toISOString(),
        endDateTime: endOfDay.toISOString(),
        $orderby: 'start/dateTime',
        $top: String(this.data.maxItems || 20),
        $select: 'subject,start,end,location,isAllDay,webLink,organizer,showAs'
      });

      const url = `https://graph.microsoft.com/v1.0/me/calendarview?${params}`;
      let response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // If 401, the cached token may be stale — clear and retry with a fresh token
      if (response.status === 401) {
        GraphAuthHelper.clearCache();
        this.loadingStatus = 'Refreshing access token...';
        this.updateContent();
        accessToken = await GraphAuthHelper.getToken();
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }

      if (!response.ok) {
        let graphError = '';
        try {
          const body = await response.json();
          graphError = body.error
            ? `${body.error.code}: ${body.error.message}`
            : JSON.stringify(body);
        } catch { /* response may not be JSON */ }

        const err = new Error(
          response.status === 401 ? 'Authentication failed. Please sign in again.'
            : response.status === 403 ? 'Access denied. Your account may not have calendar permissions.'
            : `Calendar API error: ${response.status}`
        );
        err.details = `HTTP ${response.status} from ${response.url}\n${graphError}`;
        throw err;
      }

      const data = await response.json();
      this.events = (data.value || []).map(ev => ({
        subject: ev.subject,
        startDateTime: ev.start?.dateTime,
        startTimeZone: ev.start?.timeZone,
        endDateTime: ev.end?.dateTime,
        endTimeZone: ev.end?.timeZone,
        isAllDay: ev.isAllDay,
        location: ev.location?.displayName || '',
        webLink: ev.webLink || '',
        organizer: ev.organizer?.emailAddress?.name || '',
        showAs: ev.showAs || ''
      }));

      this.lastFetched = Date.now();
      this.saveToCache();
    } catch (err) {
      const originalError = err.details
        ? `\n\n--- Original Error ---\n${err.details}`
        : `\n\n--- Original Error ---\n${err.message || 'Unknown error'}\n${err.stack || ''}`;

      if (!navigator.onLine) {
        this.error = {
          message: 'You appear to be offline',
          details: 'Please check your internet connection and try again.' + originalError
        };
      } else {
        this.error = {
          message: err.message || 'Failed to fetch calendar events',
          details: err.details || err.stack || null
        };
      }
      this.errorDialogOpen = true;
      GraphAuthHelper.handleAuthError(this.error.message);
    } finally {
      this.loading = false;
      this.loadingStatus = '';
      this.updateContent();
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  formatEventTime(event) {
    if (event.isAllDay) return 'All day';

    const startLocal = this.toLocalTime(event.startDateTime, event.startTimeZone);
    const endLocal = this.toLocalTime(event.endDateTime, event.endTimeZone);

    const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${fmt(startLocal)} \u2013 ${fmt(endLocal)}`;
  }

  toLocalTime(dateTimeStr, timeZone) {
    if (!dateTimeStr) return new Date();
    // Graph returns dateTime without offset when timeZone is specified.
    // If timeZone is UTC, append Z; otherwise parse as-is (local).
    if (timeZone === 'UTC') {
      return new Date(dateTimeStr + 'Z');
    }
    return new Date(dateTimeStr);
  }

  isCurrentEvent(event) {
    if (event.isAllDay) return true;
    const now = Date.now();
    const start = this.toLocalTime(event.startDateTime, event.startTimeZone).getTime();
    const end = this.toLocalTime(event.endDateTime, event.endTimeZone).getTime();
    return now >= start && now < end;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getShowAsClass(showAs) {
    switch (showAs) {
      case 'busy': return 'calendar-busy';
      case 'tentative': return 'calendar-tentative';
      case 'oof': return 'calendar-oof';
      case 'free': return 'calendar-free';
      default: return '';
    }
  }

  renderEvent(event) {
    const time = this.formatEventTime(event);
    const subject = this.escapeHtml(event.subject || '(No subject)');
    const location = event.location ? this.escapeHtml(event.location) : '';
    const currentClass = this.isCurrentEvent(event) ? 'calendar-event-current' : '';
    const showAsClass = this.getShowAsClass(event.showAs);
    const allDayClass = event.isAllDay ? 'calendar-event-allday' : '';

    const locationHtml = location
      ? `<span class="calendar-event-location">${location}</span>`
      : '';

    const linkOpen = event.webLink
      ? `<a href="${this.escapeHtml(event.webLink)}" target="_blank" class="calendar-event-link">`
      : '<div class="calendar-event-link">';
    const linkClose = event.webLink ? '</a>' : '</div>';

    return `
      <li class="calendar-event ${currentClass} ${showAsClass} ${allDayClass}">
        ${linkOpen}
          <div class="calendar-event-time">${time}</div>
          <div class="calendar-event-details">
            <span class="calendar-event-subject">${subject}</span>
            ${locationHtml}
          </div>
        ${linkClose}
      </li>
    `;
  }

  getContent() {
    const lastFetchedStr = this.lastFetched
      ? TimeFormatter.formatRelative(this.lastFetched)
      : '';

    const displayTitle = this.escapeHtml(this.data.title || 'Today\'s Agenda');

    let statusHtml = '';
    if (this.loading) {
      statusHtml = `<span class="ado-widget-status-indicator ado-widget-status-loading" title="${this.loadingStatus || 'Loading...'}">⟳</span>`;
    } else if (this.error) {
      statusHtml = `<button class="ado-widget-status-indicator ado-widget-status-error ado-widget-error-btn" title="Click to see error details">⚠️</button>`;
    }

    let errorDialogHtml = '';
    if (this.error && this.errorDialogOpen) {
      const errorMessage = this.escapeHtml(this.error.message || this.error);
      const errorDetails = this.error.details ? `<pre class="ado-widget-error-details">${this.escapeHtml(this.error.details)}</pre>` : '';
      errorDialogHtml = `
        <div class="ado-widget-error-dialog">
          <div class="ado-widget-error-dialog-header">
            <span>Error</span>
            <button class="ado-widget-error-dialog-close" title="Close">✕</button>
          </div>
          <div class="ado-widget-error-dialog-content">
            <p class="ado-widget-error-message">${errorMessage}</p>
            ${errorDetails}
          </div>
          <div class="ado-widget-error-dialog-actions">
            <button class="ado-widget-retry">Retry</button>
          </div>
        </div>
      `;
    }

    let listContent;
    if (this.events.length === 0 && !this.loading) {
      listContent = `
        <div class="ado-widget-empty">
          <div class="ado-widget-icon">📅</div>
          <p>No more events today</p>
        </div>
      `;
    } else {
      listContent = `
        <ul class="calendar-event-list">
          ${this.events.map(ev => this.renderEvent(ev)).join('')}
        </ul>
      `;
    }

    return `
      <div class="ado-widget-header">
        <span class="ado-widget-title">${displayTitle}</span>
        <span class="ado-widget-last-updated" title="Last updated">${lastFetchedStr}</span>
        ${statusHtml}
        <button class="ado-widget-refresh" title="Reload">⟳</button>
      </div>
      ${listContent}
      ${errorDialogHtml}
    `;
  }

  updateContent() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.widget-content');
    if (!contentEl) return;
    contentEl.innerHTML = this.getContent();
  }

  // ---------------------------------------------------------------------------
  // Behavior
  // ---------------------------------------------------------------------------

  setupBehavior(element) {
    element.addEventListener('click', (e) => {
      if (e.target.classList.contains('ado-widget-refresh') ||
          e.target.classList.contains('ado-widget-retry')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = false;
        this.refresh();
      }
      if (e.target.classList.contains('ado-widget-error-btn')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = !this.errorDialogOpen;
        this.updateContent();
      }
      if (e.target.classList.contains('ado-widget-error-dialog-close')) {
        e.preventDefault();
        e.stopPropagation();
        this.errorDialogOpen = false;
        this.updateContent();
      }
    });

    if (!this.lastFetched) {
      this.refresh();
    } else {
      this.updateContent();
    }
    this.startAutoRefresh();
  }

  startAutoRefresh() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.data.refreshInterval || this.data.refreshInterval <= 0) return;
      const intervalMs = this.data.refreshInterval * 60 * 1000;
      if (!this.lastFetched || (Date.now() - this.lastFetched) >= intervalMs) {
        this.refresh();
      }
    }, 60000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
