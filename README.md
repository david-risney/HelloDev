# HelloDev - Browser Extension

A simple browser extension that replaces the default new tab page with a clean, personalized experience.

## Features

- **Time-based greeting** - Displays "Good Morning", "Good Afternoon", or "Good Evening"
- **Live clock** - Shows the current time, updated every second
- **Quick search** - Search Google directly from the new tab page
- **Beautiful design** - Clean gradient background with modern styling

## Installation

### Chrome / Edge

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `src` folder

### Firefox

Firefox uses a different manifest format. This extension is designed for Chromium-based browsers.

## Usage

After installation, open a new tab to see your custom new tab page. Type in the search box and press Enter to search Google.

## Project Structure

```
├── src/                 # Extension package folder
│   ├── manifest.json    # Extension configuration
│   ├── hellodev.html    # Main page markup
│   ├── hellodev.css     # Styles
│   ├── hellodev.js      # JavaScript functionality
│   └── icons/           # Extension icons (placeholder)
├── README.md
└── .github/
```

## Customization

- **Colors**: Edit the gradient in `hellodev.css` (body background)
- **Search engine**: Change the URL in `hellodev.js` `handleSearch` function
- **Features**: Add widgets or links in `hellodev.html`

## Icons

The `icons/` folder requires PNG icons at these sizes:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

> **Note**: Icons are placeholders. Replace with your own icons before publishing.
