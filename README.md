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

## Development & Testing

### Validating with Chrome DevTools MCP

This project includes a `.vscode/mcp.json` that configures the
[Chrome DevTools MCP](https://github.com/anthropics/chrome-devtools-mcp) server so
Copilot can launch a browser, install the extension, and verify it works.

**Key setup notes:**

- **`--executablePath`** in `.vscode/mcp.json` must point to your local Edge (or
  Chrome) binary. Update this if your installation path differs.
- **`--category-extensions`** is required to enable extension-management tools
  (install, uninstall, list, reload). Without it those tools won't appear.

**Validation workflow (automated by Copilot):**

1. Install the extension from the `src` folder.
2. Navigate to the extension's new tab page.
3. Confirm zero console errors.
4. Screenshot the page and inspect the DOM for expected elements (greeting, clock,
   toolbar buttons, widget controls).
5. Verify the extension appears enabled with no manifest warnings.

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the
full checklist Copilot follows automatically.

## Icons

The `icons/` folder requires PNG icons at these sizes:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

> **Note**: Icons are placeholders. Replace with your own icons before publishing.
