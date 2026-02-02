import { WidgetBase } from './WidgetBase.js';

/**
 * Greeting widget - displays time-based greeting
 */
export class GreetingWidget extends WidgetBase {
  constructor(config) {
    super({ ...config, type: 'greeting' });
  }

  getConfigSchema() {
    return [
      {
        key: 'name',
        label: 'Your Name',
        type: 'string',
        default: ''
      },
      {
        key: 'subtitle',
        label: 'Subtitle',
        type: 'string',
        default: 'Welcome to HelloDev'
      }
    ];
  }

  getContent() {
    const subtitle = this.data.subtitle ?? 'Welcome to HelloDev';
    return `
      <div class="greeting-text">Hello!</div>
      <div class="greeting-sub">${subtitle}</div>
    `;
  }

  onTick() {
    const greetingEl = this.element?.querySelector('.greeting-text');
    if (greetingEl) {
      const hour = new Date().getHours();
      const name = this.data.name ? `, ${this.data.name}` : '';
      if (hour < 12) {
        greetingEl.textContent = `Good Morning${name}!`;
      } else if (hour < 18) {
        greetingEl.textContent = `Good Afternoon${name}!`;
      } else {
        greetingEl.textContent = `Good Evening${name}!`;
      }
    }
  }
}
