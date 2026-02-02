import { WidgetBase } from './WidgetBase.js';

/**
 * Clock widget - displays current time and date
 */
export class ClockWidget extends WidgetBase {
  constructor(config) {
    super({ ...config, type: 'clock' });
  }

  getContent() {
    return `
      <div class="time" id="clock-time">--:--</div>
      <div class="date" id="clock-date"></div>
    `;
  }

  onTick() {
    const now = new Date();
    const timeEl = this.element?.querySelector('.time');
    const dateEl = this.element?.querySelector('.date');

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  }
}
