# HelloDev modernization

## Decisions and implemented scope

2026-11-12. Preserve the useful new-tab shell and saved layouts; replace
duplicated provider logic instead of rewriting everything because of its age.
The DevDash session's consumer contract is authoritative:
[browser contract](https://github.com/david-risney/DevDash#browser-consumer-contract)
and [normalized results](https://github.com/david-risney/DevDash#json-result-contract).

Implemented:

- One DevDash native-port client and shared work-widget renderer. The six old
  widget types are compatibility subclasses, not independent data adapters.
- Profile/query references only; no provider credentials or duplicate filters
  in current work-widget configs. Provider-native state and `providerData`
  survive rendering. No inference of review obligations from reviewer votes.
- Adaptive reads on load/interval, paged projected responses, snapshot-bound
  cursors, explicit errors and truncation, detached forced refreshes with
  job-ID-aware status checks. No event stream, subscriptions or STALE labels.
- Cards/table views, native details disclosures, semantic headers and
  keyboard-scrollable tables. Presentation sorting never changes shared queries.
- Cancellation and generation checks for config changes/removal. Destroy old
  widgets before replacing dashboard state so observers/timers do not leak.
- Reproducible unit, isolated extension and Chrome DevTools MCP validation;
  optional real DevDash native-protocol integration against public GitHub.
  No normal-profile browser automation or registry changes during tests.
- No remote-font dependency; explicit toolbar accessible names. New-user
  clock and onboarding no longer overlap. Existing layouts are not rearranged.
- Removed browser-side provider token RPCs, identity permission and provider
  host permissions. DevDash owns authenticated provider network access.

The old provider-specific REST/CSV/auth code in the six widgets is gone.
Dormant, unregistered Calendar/DevBox code and compatibility auth/native-host
files are not a second supported work-widget backend. Their separate cleanup
or reintroduction needs a scoped change, not a bulk rewrite of unrelated code.
Re-enabling dormant widgets requires reviewing their permissions and transport;
the default manifest no longer reserves those unused capabilities.

## Copilot integration

### Recommendation: two extension lanes, one reviewed repository

Keep the installed extension declarative and store-compatible. Put Copilot
and filesystem/git operations in an explicitly installed **local developer
host**, distinct from DevDash. Make a separate unpacked worktree extension
the executable preview. Do not fetch generated JavaScript into the installed
extension or relax its CSP to evaluate it.

```text
Installed HelloDev / development panel
  -> schema-validated developer requests over native messaging
  -> local developer host
       -> Copilot SDK / CLI, user-authorized worktree and tools
       -> tests + isolated browser + MCP diagnostics
       -> diff + manifest capability delta + preview artifact
  <- job status, sanitized diagnostics, review/preview controls

Separate unpacked worktree extension in a development browser profile
  -> packaged local files
  -> DevDash native host for its selected queries
```

The [Copilot SDK](https://github.com/github/copilot-sdk) controls the CLI runtime
over JSON-RPC and belongs in the Node host, not the extension page.
Pin/test the chosen SDK and runtime versions when implementing this lane;
permission callbacks, cancellation and session-resume APIs must be verified
against those versions. No Copilot dependency or credential is added yet.

### What can change immediately?

| Change | Installed extension | Development preview |
| --- | --- | --- |
| Layout/theme/query references for bundled widgets | Validate JSON, preview, accept/undo; no code reload | Same |
| Provider query/filter | Use DevDash named-query validation and revision-checked save; explicit approval because other consumers share it | Same, preferably an isolated profile |
| JS/HTML/CSS implementation | Reviewed release/update only | Write local worktree files, test, then reload unpacked extension |
| New host/API permission | Must already be declared as optional and requested from a user gesture, or ship a new manifest/update | Show manifest delta; reload/reinstall and obtain browser approval as required |
| New native capability | Explicit local host update/registration | Explicit developer setup; never silently broaden allowed origins |

The manifest is a **capability declaration**, not a list of every widget or
every local source file. Bundled widgets can evolve within existing rights.
New optional origins/permissions still need advance declaration and an explicit
grant. Mandatory permission changes may disable an extension until re-enabled.
Do not predeclare all hosts, `management`, `debugger`, `scripting` or unrestricted
code execution to avoid future prompts.

[Remote-hosted code rules](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
require executable extension code to be bundled. JSON is data only while its
schema describes known capabilities; do not smuggle a JS interpreter, expressions
or arbitrary executable URLs into a "layout" format. Sandbox/user-script APIs
are not a policy workaround for self-updating the installed product.
Store acceptance of any future developer feature still needs review.

### Local host trust boundary

Use a separate name such as `com.hellodev.developer`. DevDash remains a
query/cache service, not a general shell or Copilot launcher.
Follow [native messaging registration](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging):
allow only exact stable/development extension IDs, with explicit per-user
installation. No inbound localhost server, anonymous tunnel or external-message
listener is necessary.

Expose small operations, not `exec(command)` or caller-controlled filesystem paths:
`hello`, `workspace-info`, `propose-layout`, `start-change`, `job-status`,
`cancel-job`, `preview`, `diff`, `accept` and `discard`. Names are proposed,
not an implemented wire contract. Schema/version every request and response;
enforce size/time/credit limits, correlation IDs and idempotent job IDs.
Approval tokens must bind the job and exact diff hash to avoid approving
different content later.

Select the repository/root outside untrusted page content. Resolve and verify
real paths, including symlinks/junctions, before host file operations; create a
dedicated worktree/branch and never overwrite unrelated user edits. A cwd or
Git worktree is **not a security sandbox**: the CLI and child processes retain
the OS user's access. Use real OS isolation if that access is unacceptable;
otherwise make the trust level explicit and deny unapproved tool/command,
network, dependency-install and out-of-root requests through the runtime's
permission mechanism. Do not claim path validation confines arbitrary code.

Bug text, PR text, model output and tool output are untrusted task data, not
permission to execute their instructions. Do not automatically send private
DevDash rows, browser storage, history, tokens or local files to Copilot.
Show the requested context and require opt-in. Keep Copilot auth in its normal
local credential flow; never pass it to browser storage. Save only redacted,
bounded diagnostics and user-approved context.

Persist job state outside the service worker: `created -> running -> validating
-> ready-for-preview -> accepted/discarded`, with explicit failed/cancelled
states. The page can close or the worker can restart without claiming a job
succeeded. Poll job status; stream only if the host later needs it. Cancellation
stops owned processes, not every process with a matching name. Explain that
provider refresh jobs may continue after a widget read is cancelled.

### Implementation phases and acceptance gates

1. **Foundation (implemented here):** isolated deterministic fixtures, actual
   native-protocol smoke test, MCP screenshot/DOM/console/manifest checks.
   Gate: another agent can reproduce the UI without personal credentials.
2. **Declarative customization:** bundled "Ask Copilot" panel proposes a
   validated layout patch against a revision. Side-by-side preview, apply and
   undo; no arbitrary markup, JavaScript or host selection.
   Gate: reject unknown widget types, invalid geometry and executable URLs;
   preserve existing widgets/settings on cancel and conflicting revisions.
3. **Developer host + worktree job:** explicitly opt in, install/register the
   host, select a trusted checkout, start a Copilot SDK session there and
   enforce tool permissions/budgets. Return a diff, not in-page code.
   Gate: cancellation, browser close/reopen, stale approvals, dirty worktrees
   and denied outside-root/tool requests have reliable outcomes.
4. **Try the code:** run unit/E2E/MCP checks on that worktree, then load/reload
   it in an isolated development browser. Show tests, console, screenshot,
   changed capabilities and the exact revision. Use MCP's reload operation;
   `chrome.runtime.reload()` alone neither grants new permissions nor changes
   an installed store package to point at a worktree. Snapshot layout first.
   Gate: manifest changes require explicit approval; failed previews retain
   the last working revision and can be reverted without data loss.
5. **Submit:** after explicit approval of the tested diff, create a commit and
   PR through the normal repository workflow, including AI attribution.
   Publishing/merging is separate approval. Gate: tested tree matches submitted
   diff; no credentials, local paths, private context or test artifacts included.

A separate preview browser is important: two new-tab override extensions in
one everyday profile compete to own new tabs. Do not silently disable the
installed HelloDev to try the worktree.

## Widget UI direction

**Decision now:** keep a lightweight browser dashboard and standardize work
widgets on DevDash cards/tables. Do not adopt another full dashboard server
or introduce a framework merely for rearrangement.

| Candidate | What it provides | Fit / cost |
| --- | --- | --- |
| [GridStack](https://gridstackjs.com/) ([source](https://github.com/gridstack/gridstack.js), MIT) | Framework-independent draggable/resizable grid, persistence, nested layouts | Best candidate if replacing custom layout mechanics; bundle JS/CSS locally. Needs a spike for keyboard accessibility, overlap/layering, stretch-fill and saved-coordinate migration |
| [Muuri](https://muuri.dev/) | Sorting/filtering, drag-based responsive layouts | Useful for ordered cards; does not by itself replace the current resize/layering model |
| [Homarr](https://homarr.dev/) | Complete server dashboard with drag/drop boards and many integrations | Best ready-made alternative if a hosted dashboard is acceptable; not a drop-in new-tab/native-messaging consumer |
| [Homepage](https://gethomepage.dev/) | Existing service dashboard configured with YAML/discovery | Good for a centrally configured service homepage; less aligned with direct in-browser widget arrangement |
| Native CSS Grid + existing controls | No dependency or hosting requirement; current layouts already work | Keep for this migration; improve only measured interaction/accessibility failures |

GridStack is a possible **layout engine**, not a source of authenticated
developer widgets. Homarr/Homepage would still need a DevDash adapter and a
different trusted local transport. An ordinary hosted web page cannot call an
extension's native host. A PWA would require an authenticated local service or
a deliberately narrow extension bridge; that is a different deployment model.

Before switching layout engines, prototype importing a real saved layout,
drag/resize by mouse/touch, keyboard move/resize via the existing configuration
form, minimize/maximize, background layers, narrow screens and persistence.
Do not assume library drag/drop makes the entire UI accessible.
Only adopt if it removes more custom behavior than the adapter introduces.
No new grid dependency is added in this change.

## Deferred, intentionally

Copilot developer host/panel and layout-patch schema; editing DevDash queries
from HelloDev with revision checks; provider-aware avatar hydration; a possible
grid-engine replacement; broader non-work-widget refactoring. These are not
advertised as implemented functionality. Historical credentials/exports and
previously registered token hosts are not modified on the user's machine.
