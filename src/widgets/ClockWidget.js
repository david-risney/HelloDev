import { WidgetBase } from './WidgetBase.js';

/**
 * Clock widget - displays greeting, current time and date
 */
export class ClockWidget extends WidgetBase {
  static metadata = {
    name: 'Clock',
    icon: '🕐',
    defaultSize: { width: 3, height: 2 }
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
      },
      {
        key: 'style',
        label: 'Display Style',
        type: 'select',
        options: ['Classic', 'Minimal', 'Compact', 'Digital', 'Analog', 'Modern'],
        default: 'Classic'
      }
    ];
  }

  getContent() {
    const style = (this.data.style || 'Classic').toLowerCase();
    if (style === 'analog') {
      // Generate hour markers
      const markers = Array.from({length: 12}, (_, i) => 
        `<div class="hour-marker${i % 3 === 0 ? ' major' : ''}" style="transform: rotate(${i * 30}deg)"></div>`
      ).join('');
      return `
        <div class="clock-display style-analog">
          <div class="analog-clock">
            <div class="clock-face">
              ${markers}
              <div class="hand hour-hand"></div>
              <div class="hand minute-hand"></div>
              <div class="center-dot"></div>
              <div class="clock-date"></div>
            </div>
          </div>
        </div>
      `;
    }
    if (style === 'modern') {
      return `
        <div class="clock-display style-modern">
          <div class="modern-box time-box">
            <div class="box-top"><span class="value hour">--</span></div>
            <div class="box-bottom"><span class="value minute">--</span></div>
          </div>
          <div class="modern-box date-box">
            <div class="box-top"><span class="value month">---</span></div>
            <div class="box-bottom"><span class="value day">--</span></div>
          </div>
        </div>
      `;
    }
    return `
      <div class="clock-display style-${style}">
        <div class="greeting" id="clock-greeting">Hello!</div>
        <div class="time" id="clock-time">--:--</div>
        <div class="date" id="clock-date"></div>
      </div>
    `;
  }

  setupBehavior(element) {
    // Update immediately, then every second
    this.updateClock();
    this.updateClockSize();
    this.intervalId = setInterval(() => this.updateClock(), 1000);
    
    // Watch for size changes
    this.resizeObserver = new ResizeObserver(() => this.updateClockSize());
    this.resizeObserver.observe(element);
  }

  updateClockSize() {
    const container = this.element?.querySelector('.widget-content');
    if (!container) return;
    
    const style = (this.data.style || 'Classic').toLowerCase();
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    if (style === 'analog') {
      const analogClock = this.element?.querySelector('.analog-clock');
      if (analogClock) {
        const size = Math.min(width, height) - 16;
        analogClock.style.setProperty('--size', `${size}px`);
      }
    } else if (style === 'digital') {
      const clockDisplay = this.element?.querySelector('.clock-display');
      if (clockDisplay) {
        // Scale digital display based on width
        const scale = Math.min(width / 200, height / 100, 1.5);
        clockDisplay.style.setProperty('--scale', scale);
      }
    } else if (style === 'modern') {
      const clockDisplay = this.element?.querySelector('.clock-display');
      if (clockDisplay) {
        // Determine layout based on aspect ratio
        const isHorizontal = width >= height;
        clockDisplay.classList.toggle('horizontal', isHorizontal);
        clockDisplay.classList.toggle('vertical', !isHorizontal);
      }
    } else {
      // Classic, Minimal, Compact
      const clockDisplay = this.element?.querySelector('.clock-display');
      if (clockDisplay) {
        // Scale based on container size
        const scale = Math.min(width / 180, height / 120, 1.5);
        clockDisplay.style.setProperty('--scale', Math.max(0.6, scale));
      }
    }
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // 7-segment patterns: which segments are on for each digit (a,b,c,d,e,f,g)
  static SEGMENT_PATTERNS = {
    '0': [1,1,1,1,1,1,0],
    '1': [0,1,1,0,0,0,0],
    '2': [1,1,0,1,1,0,1],
    '3': [1,1,1,1,0,0,1],
    '4': [0,1,1,0,0,1,1],
    '5': [1,0,1,1,0,1,1],
    '6': [1,0,1,1,1,1,1],
    '7': [1,1,1,0,0,0,0],
    '8': [1,1,1,1,1,1,1],
    '9': [1,1,1,1,0,1,1]
  };

  /**
   * Create HTML for a 7-segment digit
   */
  createSegmentDigit(char) {
    if (char === ':') {
      return '<div class="seg-colon"></div>';
    }
    const pattern = ClockWidget.SEGMENT_PATTERNS[char] || [0,0,0,0,0,0,0];
    const segments = ['a','b','c','d','e','f','g'];
    const segs = segments.map((s, i) => 
      `<div class="seg seg-${s}${pattern[i] ? '' : ' off'}"></div>`
    ).join('');
    return `<div class="seg-digit">${segs}</div>`;
  }

  updateClock() {
    const now = new Date();
    const style = (this.data.style || 'Classic').toLowerCase();
    
    // Handle analog clock separately
    if (style === 'analog') {
      this.updateAnalogClock(now);
      return;
    }
    
    // Handle modern clock separately
    if (style === 'modern') {
      this.updateModernClock(now);
      return;
    }
    
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
      if (style === 'digital') {
        // Digital style uses 7-segment display
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        timeEl.innerHTML = timeStr.split('').map(c => this.createSegmentDigit(c)).join('');
      } else {
        timeEl.textContent = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    if (dateEl) {
      if (style === 'compact') {
        // Compact style uses shorter date format
        dateEl.textContent = now.toLocaleDateString([], {
          month: 'short',
          day: 'numeric'
        });
      } else if (style === 'minimal') {
        // Minimal style hides date (handled in CSS)
        dateEl.textContent = now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      } else {
        dateEl.textContent = now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      }
    }
  }

  updateAnalogClock(now) {
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    
    // Calculate rotation angles
    const hourAngle = (hours * 30) + (minutes * 0.5); // 30 degrees per hour + minute offset
    const minuteAngle = minutes * 6; // 6 degrees per minute
    
    const hourHand = this.element?.querySelector('.hour-hand');
    const minuteHand = this.element?.querySelector('.minute-hand');
    const dateEl = this.element?.querySelector('.clock-date');
    
    if (hourHand) {
      hourHand.style.transform = `rotate(${hourAngle}deg)`;
    }
    if (minuteHand) {
      minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      });
    }
  }

  updateModernClock(now) {
    const hourEl = this.element?.querySelector('.value.hour');
    const minuteEl = this.element?.querySelector('.value.minute');
    const monthEl = this.element?.querySelector('.value.month');
    const dayEl = this.element?.querySelector('.value.day');
    
    if (hourEl) {
      hourEl.textContent = String(now.getHours()).padStart(2, '0');
    }
    if (minuteEl) {
      minuteEl.textContent = String(now.getMinutes()).padStart(2, '0');
    }
    if (monthEl) {
      monthEl.textContent = now.toLocaleDateString([], { month: 'short' }).toUpperCase();
    }
    if (dayEl) {
      dayEl.textContent = String(now.getDate()).padStart(2, '0');
    }
  }
}
