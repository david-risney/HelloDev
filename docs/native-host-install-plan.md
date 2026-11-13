# Native host setup

The previous HelloDev token-host install plan is superseded by
[DevDash native messaging](https://github.com/david-risney/DevDash#browser-plugin-native-messaging).

HelloDev's work widgets use `com.devdash.cli`, not `com.hellodev.ado` or
`com.hellodev.github`. The setup flyout uses the updated DevDash CLI:
`devdash native install --browser both --extension-id <id>`, and probes `hello`.
From a source checkout, `.\devdash.ps1` is an alternative to a global command.
Run setup on the browser's computer. Installation preserves existing allowed
IDs; `devdash native extensions add <id>` authorizes another copy of HelloDev
without reinstalling an existing host. These are local CLI-only operations:
HelloDev cannot install the host or edit its allowlist through native messaging.
It does not download and execute a remote script. Register the exact extension
ID; moving an unpacked extension to another checkout/worktree can change that ID.

Provider tools own credentials. The connection check verifies only the bridge,
not provider authentication. Use `devdash doctor`, then run the intended query
and consult `devdash logs tail --errors` when it fails.

See [development/testing](../README.md#run-and-test) and the separate
[Copilot development-host design](modernization.md#copilot-integration).
