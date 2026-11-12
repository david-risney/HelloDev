# HelloDev

A Chromium new-tab dashboard with rearrangeable widgets, a clock, notes, links,
search, and shared [DevDash](https://github.com/david-risney/DevDash) bug/PR/CL queries.
Plain HTML, CSS and JavaScript; no application build step.

## Run and test

Requires Node.js 22.12+ (including the browser automation tools).

```powershell
npm ci
npx playwright install chromium
npm run test:all
npm run test:browser
```

Tests use a fresh, **headless, isolated browser profile**, not your regular
browser or its extensions, credentials, history or dashboard. Nothing registers
a native host or modifies your DevDash profiles automatically.

| Command | Coverage |
| --- | --- |
| `npm run test:run` | Unit tests, migration, native-port failures, paging, rendering and lifecycle |
| `npm run test:e2e` | Real extension UI with deterministic synthetic DevDash responses |
| `npm run test:browser` | Real Chrome DevTools MCP installation, console, screenshot, accessibility snapshot and extension warnings |
| `npm run test:all` | Unit and deterministic browser tests |

MCP artifacts are in `browser-artifacts\chrome-mcp`; Playwright artifacts are
in `test-results`. Both are ignored by Git. Inspect the screenshots when
changing UI. The MCP runner discovers the server's tools before invoking them,
disables telemetry/CrUX, and shuts down its isolated browser afterward.
The [VS Code configuration](.vscode/mcp.json) also enables extension tools.

To use a particular Edge/Chrome executable, set `HELLODEV_BROWSER_PATH` to its
absolute path. `EDGE_DEV_PATH` is also supported. Otherwise tests use
Playwright's bundled Chromium. Set `HELLODEV_HEADED=1` for visible Playwright
debugging; the MCP runner remains headless.

### Optional live DevDash integration

With an existing, dependency-restored DevDash source checkout:

```powershell
$env:DEVDASH_CHECKOUT = 'C:\path\to\DevDash'
npm run test:e2e -- devdash-live.test.js
```

This sends real length-prefixed messages to `devdash-native.js` and renders
public HelloDev GitHub queries in the real extension. It uses a temporary
DevDash home/config and anonymous GitHub access. It does **not** register an
OS native host: a test-only browser binding forwards port requests to that
real process. This tests the protocol and renderer, not Chrome's registry
registration. Live ADO/Chromium authentication is not covered; deterministic
fixtures cover their normalized item shapes. Without `DEVDASH_CHECKOUT`, this
test is explicitly skipped.

## Install for everyday use

Open `edge://extensions` or `chrome://extensions`, enable Developer mode, choose
**Load unpacked**, and select `src`. The extension is Manifest V3 and supports
Chromium-based browsers, not Firefox.

For work widgets, clone/update DevDash and follow its native-host installation
instructions. From the **DevDash checkout**, register your exact extension ID:

```powershell
.\scripts\install-native-host.ps1 -ExtensionId YOUR_32_CHARACTER_EXTENSION_ID -Browser Both
```

The **DevDash Setup** panel displays the command with your actual ID and can
check the connection. Review the local installer before running it. HelloDev
no longer downloads and executes a remote installation script.
The old HelloDev token-host installers are not the DevDash setup path.

Configure profiles/queries and provider login in DevDash. Add a **DevDash Query**
widget or provider pack, then set **DevDash profile** and **Named query**.
Leave the query blank only for a flat, single-query profile.
DevDash owns provider filters (including JavaScript predicates), authentication,
refresh lifetimes and shared caches. HelloDev owns presentation only.

**Read** uses adaptive caching; **Refresh shared query** starts a detached
forced refresh, checks that job's status, and then reads a bounded cache-only
page. A failed/interrupted job is an error, not an empty success.
Normal reads happen on page load and at the configured interval, without
subscriptions or a separate browser freshness policy. Zero disables automatic
reads, not DevDash's cache lifetime. Provider result limits and paging are
shown separately. No `STALE` badge is added.

Cards show provider-neutral fields with expandable `providerData`; table view
supports compact scans and horizontal keyboard scrolling. State/priority
values retain provider semantics. Reviewer votes do not imply an approval
obligation. Sorting applies to the **loaded** rows, not unseen cached pages.

### Existing dashboards

All six existing work-widget IDs/types and layout properties remain supported.
Their titles and placement survive. Old provider filters are **not** guessed
into shared profiles: explicitly select the corresponding DevDash profile/query.
Provider credentials and duplicate provider configuration are removed from
the current widget configuration when loaded, imported, synced or exported.
Historical exports, browser-sync history and old authentication caches may
still contain old credentials; remove those separately and revoke exposed
tokens as appropriate. Other widget data and themes are preserved.

## Direction

See the [modernization and Copilot integration plan](docs/modernization.md)
for the permission model, staged self-modification workflow, UI alternatives
and remaining work. Copilot self-modification is a **design**, not an enabled
feature in this change.

The implementation keeps the existing grid and non-work widgets rather than
replacing them without evidence. The main modernization is replacing six
provider integrations with one transport/renderer and explicit lifecycle
cleanup, plus a reproducible agent-operated test loop.
