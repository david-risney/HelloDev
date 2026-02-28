import { WidgetBase } from './WidgetBase.js';

/**
 * Clock widget - displays greeting, current time and date
 */
export class ClockWidget extends WidgetBase {
  static metadata = {
    name: 'Clock',
    icon: '🕐',
    group: 'Utility',
    defaultSize: { width: 3, height: 2 },
    defaultZIndex: 1
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
        options: ['Classic', 'Digital', 'Analog', 'Modern', 'Flip'],
        default: 'Classic'
      }
    ];
  }

  getContent() {
    const style = (this.data.style || 'Classic').toLowerCase();
    if (style === 'analog') {
      // Minute tick marks (60 total, major every 5 minutes)
      const ticks = Array.from({length: 60}, (_, i) =>
        `<div class="tick${i % 5 === 0 ? ' major' : ''}" style="transform:rotate(${i * 6}deg)"></div>`
      ).join('');
      // Hour markers: pill + counter-rotated number
      const hours = Array.from({length: 12}, (_, i) => {
        const n = i + 1;
        const angle = n * 30;
        return `<div class="hour-mark" style="transform:rotate(${angle}deg)">` +
          `<div class="hour-pill"></div>` +
          `<div class="hour-num" style="transform:rotate(${-angle}deg)">${n}</div>` +
          `</div>`;
      }).join('');
      return `
        <div class="clock-display style-analog">
          <div class="analog-clock">
            ${ticks}
            ${hours}
            <div class="hour-hand"></div>
            <div class="minute-hand"></div>
            <div class="center-ring"></div>
            <div class="center-dot"></div>
            <div class="clock-date"></div>
          </div>
        </div>
      `;
    }
    if (style === 'flip') {
      // Each digit group has cards for each possible value
      const digitGroup = (prefix, count) => {
        const cards = Array.from({length: count}, (_, i) => {
          const d = String(i);
          return `<div class="flip-card" data-digit="${d}">`
            + `<div class="flip-top"><span>${d}</span></div>`
            + `<div class="flip-bottom"><span>${d}</span></div>`
            + `</div>`;
        }).join('');
        return `<div class="flip-group" data-group="${prefix}">${cards}</div>`;
      };
      return `
        <div class="clock-display style-flip">
          <div class="flip-clock">
            <div class="flip-pair flip-hours">
              ${digitGroup('h0', 3)}
              ${digitGroup('h1', 10)}
            </div>
            <div class="flip-separator">:</div>
            <div class="flip-pair flip-minutes">
              ${digitGroup('m0', 6)}
              ${digitGroup('m1', 10)}
            </div>
          </div>
          <div class="flip-ampm"></div>
        </div>
      `;
    }
    if (style === 'modern') {
      return `
        <div class="clock-display style-modern">
          <div class="flux-face">
            <div class="flux-digit flux-h0">-</div>
            <div class="flux-digit flux-h1">-</div>
            <div class="flux-digit flux-m0">-</div>
            <div class="flux-digit flux-m1">-</div>
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
        clockDisplay.style.setProperty('--flux-size', `${Math.min(width, height)}px`);
      }
    } else if (style === 'flip') {
      const clockDisplay = this.element?.querySelector('.clock-display');
      if (clockDisplay) {
        const scale = Math.min(width / 320, height / 120);
        clockDisplay.style.setProperty('--flip-scale', Math.max(0.4, scale));
      }
    } else {
      // Classic
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

    // Handle flip clock separately
    if (style === 'flip') {
      this.updateFlipClock(now);
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
      dateEl.textContent = now.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
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

  // Flux-style size variations: each digit gets a different relative size
  // to create the characteristic tightly-composed typographic layout.
  // Indexed by digit value 0-9, values are scale factors.
  static FLUX_SIZES = [
    [1.0, 0.85, 0.72, 0.90],  // :x0 – h0,h1,m0,m1
    [0.75, 0.65, 0.80, 0.95], // :x1
    [0.90, 0.78, 1.0, 0.70],  // :x2
    [0.82, 0.95, 0.68, 0.88], // :x3
    [0.70, 1.0, 0.85, 0.75],  // :x4
    [0.95, 0.72, 0.90, 0.80], // :x5
    [0.78, 0.88, 0.75, 1.0],  // :x6
    [1.0, 0.70, 0.82, 0.92],  // :x7
    [0.85, 0.92, 1.0, 0.68],  // :x8
    [0.72, 0.80, 0.95, 0.85], // :x9
  ];

  updateModernClock(now) {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const digits = [hours[0], hours[1], minutes[0], minutes[1]];
    const classes = ['.flux-h0', '.flux-h1', '.flux-m0', '.flux-m1'];
    const minute = now.getMinutes();
    const sizes = ClockWidget.FLUX_SIZES[minute % 10];

    for (let i = 0; i < 4; i++) {
      const el = this.element?.querySelector(classes[i]);
      if (el) {
        el.textContent = digits[i];
        el.style.fontSize = `calc(var(--flux-size) * ${sizes[i].toFixed(2)} * 0.46)`;
      }
    }
  }

  updateFlipClock(now) {
    const h = now.getHours();
    const m = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const hStr = String(h12).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');

    const digits = { h0: hStr[0], h1: hStr[1], m0: mStr[0], m1: mStr[1] };

    for (const [group, digit] of Object.entries(digits)) {
      const groupEl = this.element?.querySelector(`.flip-group[data-group="${group}"]`);
      if (!groupEl) continue;
      for (const card of groupEl.querySelectorAll('.flip-card')) {
        const d = card.dataset.digit;
        const wasActive = card.classList.contains('active');
        const isActive = d === digit;
        if (isActive && !wasActive) {
          // Mark previous active as outgoing
          const prev = groupEl.querySelector('.flip-card.active');
          if (prev) {
            prev.classList.remove('active');
            prev.classList.add('outgoing');
            // Remove outgoing class after animation
            setTimeout(() => prev.classList.remove('outgoing'), 500);
          }
          card.classList.add('active');
        }
      }
    }

    const ampmEl = this.element?.querySelector('.flip-ampm');
    if (ampmEl) ampmEl.textContent = ampm;
  }
}
