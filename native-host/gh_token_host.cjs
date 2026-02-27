#!/usr/bin/env node

/**
 * Native Messaging Host for HelloDev Extension
 * Gets GitHub access tokens via gh cli
 *
 * Cross-platform: Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');

/**
 * Find the gh CLI executable.
 * Chrome's native host may not have the full user PATH.
 */
function findGhCli() {
  const isWindows = process.platform === 'win32';

  // Try the command directly (works if PATH is set correctly)
  const ghCmds = isWindows ? ['gh', 'gh.exe'] : ['gh'];
  for (const ghCmd of ghCmds) {
    try {
      execSync(`${ghCmd} --version`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return ghCmd;
    } catch {
      // Continue to next candidate
    }
  }

  // Try common install locations
  const candidates = isWindows
    ? [
        `${process.env.ProgramFiles}\\GitHub CLI\\gh.exe`,
        `${process.env.LOCALAPPDATA}\\GitHub CLI\\gh.exe`,
        `${process.env.USERPROFILE}\\scoop\\shims\\gh.exe`
      ]
    : [
        '/usr/local/bin/gh',
        '/usr/bin/gh',
        '/opt/homebrew/bin/gh',
        `${process.env.HOME}/.local/bin/gh`
      ];

  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return `"${candidate}"`;
    } catch {
      // Continue
    }
  }

  return null;
}

/**
 * Read a message from stdin (Chrome native messaging protocol).
 * Messages are prefixed with a 4-byte length.
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let messageLength = null;

    process.stdin.on('readable', () => {
      // First, read the 4-byte message length
      if (messageLength === null) {
        const header = process.stdin.read(4);
        if (!header) return;
        messageLength = header.readUInt32LE(0);
      }

      // Then read the message body
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);

        if (totalLength >= messageLength) {
          const buffer = Buffer.concat(chunks);
          const message = buffer.slice(0, messageLength).toString('utf8');
          try {
            resolve(JSON.parse(message));
          } catch {
            reject(new Error('Invalid JSON message'));
          }
          return;
        }
      }
    });

    process.stdin.on('end', () => {
      reject(new Error('stdin closed'));
    });
  });
}

/**
 * Write a message to stdout (Chrome native messaging protocol).
 * Messages are prefixed with a 4-byte length.
 */
function writeMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);

  process.stdout.write(header);
  process.stdout.write(buffer);
}

/**
 * Get a GitHub access token using gh auth token.
 */
function getAccessToken() {
  let ghPath = null;

  try {
    ghPath = findGhCli();
    if (!ghPath) {
      const installUrl = 'https://cli.github.com/';
      return { error: `GitHub CLI (gh) not found. Install from ${installUrl}` };
    }

    // Check auth status
    try {
      execSync(`${ghPath} auth status`, {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
    } catch (e) {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      // gh auth status exits 1 when not logged in
      if (stderr.includes('not logged') || stderr.includes('no token') ||
          stdout.includes('not logged') || stdout.includes('no token')) {
        return {
          error: 'Not logged in to GitHub CLI. Open a terminal and run: gh auth login',
          details: [stderr, stdout].filter(Boolean).join('\n')
        };
      }
      // Otherwise it might have succeeded (gh auth status exits 0 on success
      // but some versions write to stderr too) — continue to get token
    }

    // Get the token
    let token;
    try {
      token = execSync(`${ghPath} auth token`, {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      }).trim();
    } catch (e) {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      return {
        error: 'Failed to get GitHub token. Run: gh auth login',
        details: [`gh path: ${ghPath}`, stderr, stdout, e.message].filter(Boolean).join('\n')
      };
    }

    if (!token) {
      return {
        error: 'Empty token received from gh CLI. Try running: gh auth login'
      };
    }

    // gh auth token doesn't provide expiry info, so we set a generous TTL.
    // The token is typically a long-lived OAuth token managed by gh.
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour cache

    return {
      accessToken: token,
      expiresOn
    };
  } catch (error) {
    const msg = error.message || String(error);
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';

    return {
      error: `Failed to get GitHub token: ${msg}`,
      details: [`gh path: ${ghPath}`, stderr, stdout, msg].filter(Boolean).join('\n')
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const message = await readMessage();

    if (message.action === 'getToken') {
      const result = getAccessToken();
      writeMessage(result);
    } else {
      writeMessage({ error: `Unknown action: ${message.action}` });
    }
  } catch (error) {
    writeMessage({ error: error.message });
  }

  process.exit(0);
}

main();
