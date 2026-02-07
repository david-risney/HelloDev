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
 * Find the az CLI executable
 * Chrome's native host may not have the full user PATH
 */
function findAzCli() {
  const isWindows = process.platform === 'win32';
  
  // First, try the command directly (works if PATH is set correctly)
  const azCmd = isWindows ? 'az.cmd' : 'az';
  try {
    execSync(`${azCmd} --version`, { 
      encoding: 'utf8', 
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return azCmd;
  } catch (e) {
    // Continue to check common paths
  }

  // Common installation paths
  const possiblePaths = isWindows ? [
    // Default Azure CLI installation
    'C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd',
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd',
    // Winget/scoop installations
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Azure CLI\\wbin\\az.cmd'),
    path.join(os.homedir(), 'scoop\\shims\\az.cmd'),
    // Python pip installation
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python39\\Scripts\\az.cmd'),
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python310\\Scripts\\az.cmd'),
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python311\\Scripts\\az.cmd'),
    path.join(os.homedir(), 'AppData\\Local\\Programs\\Python\\Python312\\Scripts\\az.cmd'),
  ] : [
    // macOS Homebrew
    '/usr/local/bin/az',
    '/opt/homebrew/bin/az',
    // Linux
    '/usr/bin/az',
    '/usr/local/bin/az',
    path.join(os.homedir(), '.local/bin/az'),
  ];

  for (const azPath of possiblePaths) {
    if (fs.existsSync(azPath)) {
      return azPath;
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
 * Get Azure DevOps access token using az cli
 */
function getAzureDevOpsToken() {
  try {
    // Find the az CLI executable
    const azPath = findAzCli();
    if (!azPath) {
      const installUrl = process.platform === 'win32' 
        ? 'https://aka.ms/installazurecliwindows'
        : 'https://aka.ms/InstallAzureCLIDeb';
      return { error: `Azure CLI (az) not found. Install from ${installUrl}` };
    }

    // Check if logged in by trying to get account info
    try {
      execSync(`"${azPath}" account show`, { 
        encoding: 'utf8', 
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
    } catch (e) {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      return { 
        error: 'Not logged in to Azure CLI. Open a terminal and run: az login',
        details: [stderr, stdout, e.message].filter(Boolean).join('\n')
      };
    }

    // Get the access token with expiration info
    let result;
    try {
      result = execSync(
        `"${azPath}" account get-access-token --resource ${ADO_RESOURCE} -o json`,
        { 
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        }
      );
    } catch (e) {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      return { 
        error: 'Failed to get access token',
        details: [stderr, stdout, e.message].filter(Boolean).join('\n')
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
  } catch (error) {
    const msg = error.message || String(error);
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    
    if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
      return { 
        error: 'Azure CLI timed out. Open a terminal and run: az login',
        details: [stderr, stdout, msg].filter(Boolean).join('\n')
      };
    }
    if (msg.includes('AADSTS')) {
      return { 
        error: 'Azure token expired. Open a terminal and run: az login',
        details: [stderr, stdout, msg].filter(Boolean).join('\n')
      };
    }
    
    return { 
      error: `Failed to get token: ${msg}`,
      details: [stderr, stdout, msg].filter(Boolean).join('\n')
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
      const result = getAzureDevOpsToken();
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
