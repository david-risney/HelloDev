# Copilot Instructions for HelloDev

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
