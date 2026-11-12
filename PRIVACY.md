# Privacy Policy

**Last updated:** November 12, 2026

HelloDev has no analytics or developer-operated collection server. It processes
the data needed for the widgets you choose; it is not accurate to say that all
dashboard data always stays on one device.

## Settings and browser sync

Layouts, themes, notes, links and widget configurations are stored in browser
local storage and replicated through `chrome.storage.sync` when browser sync is
available. Your browser/account controls that service. Do not put secrets in
notes or other synced settings. Current work-widget configuration contains
DevDash profile/query references and display preferences, not provider tokens
or a copy of the provider query.

## Developer work queries

Bug, PR and CL widgets communicate with the locally installed DevDash native
host (`com.devdash.cli`). DevDash uses its configured provider tools and their
credentials to contact GitHub, Azure DevOps or Chromium services, and owns its
local result caches and diagnostics. HelloDev receives normalized query
results, which can include private titles, identities and provider metadata.
These results are held in the page for display, not written to browser sync.
HelloDev does not acquire provider credentials for these work widgets.
DevDash is separately installed and configured by you.

Refreshing a shared query updates the cache other DevDash consumers use.
Removing the extension does not remove DevDash's data, profiles or native-host
registration. Manage those through DevDash.

## Other widgets and navigation

Links widgets can read top sites and recently closed tabs through browser APIs
when configured. Search and link actions navigate to their configured services.
Embedded pages, Markdown images and other remote content can contact the
origins you select, whose own privacy policies apply. HelloDev does not load a
remote font for its own UI.

Provider policies include
[GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement),
[Microsoft](https://privacy.microsoft.com/en-us/privacystatement) and
[Google](https://policies.google.com/privacy).

## Migration and control

The current migration removes old provider credentials/settings from loaded
work-widget configurations. It does not erase historical exports, browser-sync
history, old auth caches or previously installed native hosts. Delete sensitive
historical data separately and revoke tokens if they were exposed.

You can export/import or clear the current layout in Manage Data, clear browser
site/extension storage, change browser-sync settings, remove widgets or
uninstall HelloDev. Clearing the layout alone is not a secure erase of all
browser data. Automated fixture tests use isolated profiles and synthetic data.
The optional live test queries only this project's public GitHub data.

Copilot integration is a design proposal, not an enabled feature. HelloDev
currently does not send dashboard content to Copilot.

Questions: [open an issue](https://github.com/david-risney/HelloDev/issues).
