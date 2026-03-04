# Plan: Native Host Install & First-Run Guidance

**TL;DR:** When the extension loads, probe the native messaging hosts via `connectNative` from the background service worker. If they're not found, show a dismissible info banner on the new tab page recommending setup. Additionally, enhance widget-level error messages to include actionable setup links when native host errors occur. For the installation itself, bundle the `install.ps1` script inside the extension package and use `chrome.downloads.download()` + `chrome.runtime.getURL()` to save it to the user's Downloads folder, then show a one-line PowerShell command to run it. Windows only for now.

## Steps

### 1. Add `downloads` permission to `src/manifest.json`

Add `"downloads"` to the `permissions` array so the extension can use `chrome.downloads.download()` to save the bundled install script to the user's filesystem.

### 2. Copy native host files into the extension package

Add a `native-host/` subdirectory inside `src/` containing a self-contained `install.ps1` that embeds the `.cjs` scripts inline. These ship with the extension through the store. The `install.ps1` script handles generating manifests, `.bat` wrappers, and registry entries with correct absolute paths. It supports a `-ExtensionId` parameter and installs to `%APPDATA%\HelloDev\native-host\` — a stable directory that won't change across extension updates.

### 3. Add native host probe message type in `src/background.js`

Add a new case `'PROBE_NATIVE_HOST'` in the `chrome.runtime.onMessage` listener. This handler:

- Calls `chrome.runtime.connectNative(ADO_NATIVE_HOST_NAME)` (just the ADO host — if one is installed, both likely are)
- Does NOT send any message — only tests reachability
- Resolves with `{ installed: true }` on successful connect, or `{ installed: false }` on `onDisconnect` with `chrome.runtime.lastError`
- Uses a 3-second timeout since we only care about reachability

### 4. Add probe-on-load and banner UI in `src/hellodev.js`

After `renderDashboard()` in `init()`:

- Check `chrome.storage.local` for `nativeHostBannerDismissed` flag
- If not dismissed, call `chrome.runtime.sendMessage({ type: 'PROBE_NATIVE_HOST' })`
- If `{ installed: false }`, inject a dismissible banner between `<header>` and `<main>` with:
  - An info icon + message: *"Some features (ADO & GitHub widgets) need a one-time setup. Set up now"*
  - A dismiss (✕) button that hides the banner and stores `nativeHostBannerDismissed: true`
- Register `'setup'` as a new action in `handleAction()` that opens the setup flyout
- Listen for `hellodev-open-setup` custom event (dispatched from widget error dialogs)

### 5. Create a setup flyout in `src/flyouts.js`

Export a new `showSetupFlyout()` function with:

- **What it's for:** Brief explanation of native host purpose
- **Prerequisites list:** Node.js, Azure CLI, GitHub CLI — with install links
- **Step 1 — Download button:** Uses `chrome.downloads.download({ url: chrome.runtime.getURL('native-host/install.ps1') })`
- **Step 2 — Run command:** Copyable PowerShell command with 📋 button
- **Step 3 — Verify button:** Re-runs `PROBE_NATIVE_HOST` probe and shows ✅/❌ feedback

### 6. Enhance widget-level error messages in `src/widgets/DataWidgetBase.js`

In the error dialog rendering, detect when error message matches `native.?host` or `native messaging host not found`:

- Replace generic error with: *"Native host not installed. This widget needs a one-time setup to connect to your local CLI tools."*
- Add a **"Set Up"** action button that dispatches `hellodev-open-setup` custom event

### 7. Add banner + flyout CSS in `src/hellodev.css`

- **Banner:** Slide-down animation, info-level color using accent-derived oklch, dismiss button
- **Setup flyout:** Numbered steps, code block with monospace font, download/verify buttons, ✅/❌ status indicators
- **Widget error setup button:** Accent-colored button matching existing error dialog actions

## Decisions

- **Probe on every page load (not cached):** Banner reappears if native host is uninstalled. The dismissed flag only suppresses the banner, not the probe.
- **Widget-triggered errors always show guidance:** Even if banner is dismissed, widget-level errors include a "Set Up" button.
- **Single probe host:** Only probe `com.hellodev.ado` — same installer sets up both hosts.
- **Self-contained install script:** `.cjs` scripts are embedded as PowerShell here-strings inside `install.ps1` — single file download and single command to run.
- **Stable install directory:** `%APPDATA%\HelloDev\native-host\` — paths won't break across extension updates.
- **Windows only initially:** `chrome.runtime.getPlatformInfo()` can gate the feature for other platforms later.
