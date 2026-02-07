import { WidgetBase } from './WidgetBase.js';

/**
 * Clock widget - displays greeting, current time and date
 */
export class ClockWidget extends WidgetBase {
  static metadata = {
    name: 'Clock',
    icon: '🕐'
  };

  constructor(config) {
    super({ ...config, type: 'clock' });
    this.intervalId = null;
  }

  getConfigSchema() {
    return [
      {
        key: 'name',
        label: 'Your Name',
        type: 'string',
        default: ''
      }
    ];
  }

  getContent() {
    return `
      <div class="greeting" id="clock-greeting">Hello!</div>
      <div class="time" id="clock-time">--:--</div>
      <div class="date" id="clock-date"></div>
    `;
  }

  setupBehavior(element) {
    // Update immediately, then every second
    this.updateClock();
    this.intervalId = setInterval(() => this.updateClock(), 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateClock() {
    const now = new Date();
    const greetingEl = this.element?.querySelector('.greeting');
    const timeEl = this.element?.querySelector('.time');
    const dateEl = this.element?.querySelector('.date');

    if (greetingEl) {
      const hour = now.getHours();
      const name = this.data.name ? `, ${this.data.name}` : '';
      if (hour < 12) {
        greetingEl.textContent = `Good Morning${name}!`;
      } else if (hour < 18) {
        greetingEl.textContent = `Good Afternoon${name}!`;
      } else {
        greetingEl.textContent = `Good Evening${name}!`;
      }
    }

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
