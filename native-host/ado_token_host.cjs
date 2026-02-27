#!/usr/bin/env node

/**
 * Native Messaging Host for HelloDev Extension
 * Gets Azure DevOps access tokens via az cli
 * 
 * Cross-platform: Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Azure DevOps resource ID
const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';

/**
 * Find the az CLI executable.
 * Uses where/which for a fast filesystem lookup instead of invoking az
 * (which starts the Python runtime and can take several seconds).
 * Chrome's native host may not have the full user PATH.
 */
function findAzCli() {
  const isWindows = process.platform === 'win32';
  const locateCmd = isWindows ? 'where' : 'which';

  // Candidates: on Windows az ships as az.cmd; 'az' alone may also work.
  const azCmds = isWindows ? ['az.cmd', 'az'] : ['az'];
  for (const azCmd of azCmds) {
    try {
      const result = execSync(`${locateCmd} ${azCmd}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      // where/which prints the resolved path — if it succeeds the command exists
      if (result.trim()) return azCmd;
    } catch (_) {
      // Not found via this candidate, try next
    }
  }

  return null;
}

/**
 * Read a message from stdin (Chrome native messaging protocol)
 * Messages are prefixed with a 4-byte length
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let messageLength = null;

    process.stdin.on('readable', () => {
      let chunk;
      
      // First, read the 4-byte message length
      if (messageLength === null) {
        const header = process.stdin.read(4);
        if (!header) return;
        messageLength = header.readUInt32LE(0);
      }
      
      // Then read the message body
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        
        if (totalLength >= messageLength) {
          const buffer = Buffer.concat(chunks);
          const message = buffer.slice(0, messageLength).toString('utf8');
          try {
            resolve(JSON.parse(message));
          } catch (e) {
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
 * Write a message to stdout (Chrome native messaging protocol)
 * Messages are prefixed with a 4-byte length
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
 * Get an access token for the given resource using az cli
 * @param {string} [resource] - The resource to get a token for (defaults to ADO_RESOURCE)
 */
function getAccessToken(resource) {
  const targetResource = resource || ADO_RESOURCE;

  // Find the az CLI executable (fast where/which lookup)
  const azPath = findAzCli();
  if (!azPath) {
    const installUrl = process.platform === 'win32'
      ? 'https://aka.ms/installazurecliwindows'
      : 'https://aka.ms/InstallAzureCLIDeb';
    return { error: `Azure CLI (az) not found. Install from ${installUrl}` };
  }

  // Get the access token directly — this single call tells us everything:
  // - whether az works
  // - whether we're logged in
  // - the token itself
  let result;
  try {
    result = execSync(
      `${azPath} account get-access-token --resource ${targetResource} -o json`,
      {
        encoding: 'utf8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      }
    );
  } catch (e) {
    const stderr = (e.stderr?.toString() || '').trim();
    const stdout = (e.stdout?.toString() || '').trim();
    const combined = `${stderr} ${stdout}`.toLowerCase();

    // Detect login-related errors from get-access-token output
    const isLoginError =
      combined.includes('az login') ||
      combined.includes('please run') ||
      combined.includes('aadsts') ||
      combined.includes('no subscription') ||
      combined.includes('not logged in') ||
      combined.includes('refresh token') ||
      combined.includes('interactive login');

    if (isLoginError) {
      return {
        error: 'Not logged in to Azure CLI. Open a terminal and run: az login',
        details: [`az path: ${azPath}`, stderr, stdout, e.message].filter(Boolean).join('\n')
      };
    }

    return {
      error: 'Failed to get access token',
      details: [`az path: ${azPath}`, stderr, stdout, e.message].filter(Boolean).join('\n')
    };
  }
    
  const tokenData = JSON.parse(result.trim());
  if (!tokenData.accessToken) {
    return { 
      error: 'Empty token received. Try running: az login',
      details: result
    };
  }
    
  return { 
    accessToken: tokenData.accessToken,
    expiresOn: tokenData.expiresOn  // ISO 8601 datetime string
  };
}

/**
 * Main entry point
 */
async function main() {
  try {
    const message = await readMessage();
    
    if (message.action === 'getToken') {
      const result = getAccessToken(message.resource);
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
