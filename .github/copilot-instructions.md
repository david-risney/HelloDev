# Copilot Instructions for HelloDev

## Reproducible validation

Run `npm ci`, then `npx playwright install chromium` when the test browser is
missing. Use `npm run test:all` for unit and deterministic extension tests,
and `npm run test:browser` for the Chrome DevTools MCP checklist below.
The latter discovers/calls the real MCP tools and saves console, accessibility
snapshot, screenshot and manifest-warning artifacts under
`browser-artifacts\chrome-mcp`. Inspect the screenshot after UI changes.

Both runners use fresh headless profiles. Never attach these checks to the
user's normal browser or silently register/overwrite a native host.
`HELLODEV_BROWSER_PATH` overrides the executable; otherwise the script uses
Playwright's bundled Chromium.

Work widgets use `com.devdash.cli`, normalized common fields plus `providerData`,
and profile/query references. Provider authentication, filtering and cache
freshness belong to DevDash. Do not restore browser-side tokens/provider fetches,
add STALE labels or require an event/subscription protocol.
The optional `DEVDASH_CHECKOUT` live test uses isolated public GitHub queries;
deterministic fixtures must not require personal credentials.

## Validating the Extension with Chrome DevTools MCP

After making changes to the extension, use the **Chrome DevTools MCP** to validate
that the extension loads and runs correctly. Follow these steps:

1. **Install the extension** — use `install_extension` with the `src` folder path.
2. **Navigate to the new tab page** — open `chrome-extension://<id>/hellodev.html`.
3. **Check the console** — use `list_console_messages` to verify there are no errors.
4. **Take a screenshot** — use `take_screenshot` to visually confirm the UI renders.
5. **Inspect the DOM** — use `take_snapshot` to verify interactive elements are present
   (menu, widget buttons, clock, greeting, etc.).
6. **Check extensions list** — use `list_extensions` to confirm the extension is
   enabled with no manifest warnings.

### What to look for

- **Zero console errors** on the extension page.
- **Correct time-based greeting** ("Good Morning" / "Good Afternoon" / "Good Evening").
- **Clock widget** displaying current time and date.
- **Welcome/onboarding widget** with the getting-started checklist.
- **All toolbar buttons** present: Menu (☰), Add Widget (➕), Customize (🖌️),
  Manage Data (🗂️), About (ℹ️).
- **Per-widget controls** (⚙ Configure) accessible in the DOM snapshot.

## Chrome DevTools MCP Setup

The project includes a `.vscode/mcp.json` that configures the Chrome DevTools MCP
server. Two important settings to note:

- **`--executablePath`** — Points to the Edge (Dev) binary. Update this path if your
  Edge installation is in a different location. The default is:
  `C:\Users\davris\AppData\Local\Microsoft\Edge Dev\Application\msedge.exe`
- **`--category-extensions`** — This flag is **required** to enable the MCP tools for
  managing browser extensions (install, uninstall, list, reload). Without it, extension
  management tools will not be available.
