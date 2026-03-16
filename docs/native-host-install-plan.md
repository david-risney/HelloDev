# Plan: Native Host Install & First-Run Guidance

**TL;DR:** When the extension loads, probe the native messaging hosts via `connectNative` from the background service worker. If they're not found, show a dismissible info banner on the new tab page recommending setup. Additionally, enhance widget-level error messages to include actionable setup links when native host errors occur. For the installation itself, the self-contained `install.ps1` script is checked into the GitHub repo at `src/native-host/install.ps1`. The setup flyout shows a single copyable PowerShell one-liner that downloads and executes the script directly from GitHub — no separate download step or `downloads` permission required. Windows only for now.

## Steps

### 1. Self-contained install script in the repo

The self-contained `install.ps1` at `src/native-host/install.ps1` embeds the `.cjs` scripts inline as PowerShell here-strings. It handles generating manifests, `.bat` wrappers, and registry entries with correct absolute paths. It supports a `-ExtensionId` parameter and installs to `%APPDATA%\HelloDev\native-host\` — a stable directory that won't change across extension updates.

Because the script is fetched directly from GitHub at install time, there is **no need** for a `downloads` permission in the manifest — the extension never writes files to the user's filesystem.

### 2. Add native host probe message type in `src/background.js`

Add a new case `'PROBE_NATIVE_HOST'` in the `chrome.runtime.onMessage` listener. This handler:

- Calls `chrome.runtime.connectNative(ADO_NATIVE_HOST_NAME)` (just the ADO host — if one is installed, both likely are)
- Does NOT send any message — only tests reachability
- Resolves with `{ installed: true }` on successful connect, or `{ installed: false }` on `onDisconnect` with `chrome.runtime.lastError`
- Uses a 3-second timeout since we only care about reachability

### 3. Add probe-on-load and banner UI in `src/hellodev.js`

After `renderDashboard()` in `init()`:

- Check `chrome.storage.local` for `nativeHostBannerDismissed` flag
- If not dismissed, call `chrome.runtime.sendMessage({ type: 'PROBE_NATIVE_HOST' })`
- If `{ installed: false }`, inject a dismissible banner between `<header>` and `<main>` with:
  - An info icon + message: *"Some features (ADO & GitHub widgets) need a one-time setup. Set up now"*
  - A dismiss (✕) button that hides the banner and stores `nativeHostBannerDismissed: true`
- Register `'setup'` as a new action in `handleAction()` that opens the setup flyout
- Listen for `hellodev-open-setup` custom event (dispatched from widget error dialogs)

### 4. Create a setup flyout in `src/flyouts.js`

Export a new `showSetupFlyout()` function with:

- **What it's for:** Brief explanation of native host purpose
- **Prerequisites list:** Node.js, Azure CLI, GitHub CLI — with install links
- **Step 1 — Run command:** A single copyable PowerShell one-liner with 📋 button that downloads and executes the install script from GitHub:
  ```powershell
  iex (irm 'https://raw.githubusercontent.com/david-risney/HelloDev/main/src/native-host/install.ps1')
  ```
  When the extension ID differs from the default, the command uses `[scriptblock]::Create()` to pass `-ExtensionId`.
- **Step 2 — Verify button:** Re-runs `PROBE_NATIVE_HOST` probe and shows ✅/❌ feedback

### 5. Enhance widget-level error messages in `src/widgets/DataWidgetBase.js`

In the error dialog rendering, detect when error message matches `native.?host` or `native messaging host not found`:

- Replace generic error with: *"Native host not installed. This widget needs a one-time setup to connect to your local CLI tools."*
- Add a **"Set Up"** action button that dispatches `hellodev-open-setup` custom event

### 6. Add banner + flyout CSS in `src/hellodev.css`

- **Banner:** Slide-down animation, info-level color using accent-derived oklch, dismiss button
- **Setup flyout:** Numbered steps, code block with monospace font, download/verify buttons, ✅/❌ status indicators
- **Widget error setup button:** Accent-colored button matching existing error dialog actions

## Decisions

- **Probe on every page load (not cached):** Banner reappears if native host is uninstalled. The dismissed flag only suppresses the banner, not the probe.
- **Widget-triggered errors always show guidance:** Even if banner is dismissed, widget-level errors include a "Set Up" button.
- **Single probe host:** Only probe `com.hellodev.ado` — same installer sets up both hosts.
- **Self-contained install script:** `.cjs` scripts are embedded as PowerShell here-strings inside `install.ps1`. The script is fetched and executed directly from GitHub via a single PowerShell one-liner — no download step or `downloads` permission needed.
- **Stable install directory:** `%APPDATA%\HelloDev\native-host\` — paths won't break across extension updates.
- **Windows only initially:** `chrome.runtime.getPlatformInfo()` can gate the feature for other platforms later.
