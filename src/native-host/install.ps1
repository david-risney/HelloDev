# HelloDev Native Host Installer (Self-Contained)
# This script installs the native messaging hosts that let HelloDev get
# auth tokens from your local Azure CLI and GitHub CLI.
#
# Usage:
#   iex (irm 'https://raw.githubusercontent.com/david-risney/HelloDev/main/src/native-host/install.ps1')
#   & ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/david-risney/HelloDev/main/src/native-host/install.ps1'))) -ExtensionId "your-extension-id"

param(
    [string]$ExtensionId = "nhfaibfkboppjdaiiaocmdkahcmglgbh"
)

$ErrorActionPreference = "Stop"

# Install location — stable directory that won't change across extension updates
$InstallDir = Join-Path $env:APPDATA "HelloDev\native-host"

# Native host names
$AdoHostName = "com.hellodev.ado"
$GitHubHostName = "com.hellodev.github"

Write-Host ""
Write-Host "HelloDev Native Host Installer" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Install directory: $InstallDir"
Write-Host "Extension ID:      $ExtensionId"
Write-Host ""

# ============================================================================
# Embedded Native Host Scripts
# ============================================================================
# These are the Node.js scripts that Chrome/Edge will launch to get tokens.
# They are embedded here so this is a single self-contained installer.

$AdoTokenHostScript = @'
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
'@

$GitHubTokenHostScript = @'
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
 * Uses where/which for a fast filesystem lookup instead of invoking gh
 * (avoids startup overhead).
 * Chrome's native host may not have the full user PATH.
 */
function findGhCli() {
  const isWindows = process.platform === 'win32';
  const locateCmd = isWindows ? 'where' : 'which';

  // Try the command directly (works if PATH is set correctly)
  const ghCmds = isWindows ? ['gh.exe', 'gh'] : ['gh'];
  for (const ghCmd of ghCmds) {
    try {
      const result = execSync(`${locateCmd} ${ghCmd}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      if (result.trim()) return ghCmd;
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

  const { existsSync } = require('fs');
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return `"${candidate}"`;
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
  const ghPath = findGhCli();
  if (!ghPath) {
    const installUrl = 'https://cli.github.com/';
    return { error: `GitHub CLI (gh) not found. Install from ${installUrl}` };
  }

  // Get the token directly — a single call that also reveals auth status.
  // If the user isn't logged in, gh auth token exits non-zero with a
  // descriptive message, so a separate `gh auth status` check is unnecessary.
  let token;
  try {
    token = execSync(`${ghPath} auth token`, {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    }).trim();
  } catch (e) {
    const stderr = (e.stderr?.toString() || '').trim();
    const stdout = (e.stdout?.toString() || '').trim();
    const combined = `${stderr} ${stdout}`.toLowerCase();

    const isLoginError =
      combined.includes('not logged') ||
      combined.includes('no token') ||
      combined.includes('gh auth login') ||
      combined.includes('no oauth');

    if (isLoginError) {
      return {
        error: 'Not logged in to GitHub CLI. Open a terminal and run: gh auth login',
        details: [`gh path: ${ghPath}`, stderr, stdout].filter(Boolean).join('\n')
      };
    }

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
'@

# ============================================================================
# Step 1: Create install directory
# ============================================================================

Write-Host "Creating install directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Write-Host "  $InstallDir" -ForegroundColor Green

# ============================================================================
# Step 2: Check for Node.js
# ============================================================================

Write-Host ""
Write-Host "Checking for Node.js..." -ForegroundColor Yellow
$nodeVersion = $null
try {
    $nodeVersion = & node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Host "Node.js is not installed. Installing via winget..." -ForegroundColor Yellow
    
    try {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Host "  Node.js $nodeVersion installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "  Node.js installed but not in PATH. Please restart PowerShell and run this script again." -ForegroundColor Red
            return
        }
    } catch {
        Write-Host "  Failed to install Node.js via winget. Please install manually from https://nodejs.org" -ForegroundColor Red
        return
    }
} else {
    Write-Host "  Node.js $nodeVersion is installed." -ForegroundColor Green
}

# ============================================================================
# Step 3: Check for Azure CLI
# ============================================================================

Write-Host ""
Write-Host "Checking for Azure CLI..." -ForegroundColor Yellow
$azVersion = $null
try {
    $azVersion = & az --version 2>$null | Select-Object -First 1
} catch {}

if (-not $azVersion) {
    Write-Host "Azure CLI is not installed. Installing via winget..." -ForegroundColor Yellow
    
    try {
        winget install Microsoft.AzureCLI --accept-package-agreements --accept-source-agreements
        
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        $azVersion = & az --version 2>$null | Select-Object -First 1
        if ($azVersion) {
            Write-Host "  Azure CLI installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "  Azure CLI installed but not in PATH. Please restart PowerShell and run this script again." -ForegroundColor Red
            return
        }
    } catch {
        Write-Host "  Failed to install Azure CLI via winget." -ForegroundColor Red
        Write-Host "  Trying MSI installer..." -ForegroundColor Yellow
        
        try {
            $msiUrl = "https://aka.ms/installazurecliwindows"
            $msiPath = Join-Path $env:TEMP "AzureCLI.msi"
            
            Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath
            Start-Process msiexec.exe -ArgumentList "/i", $msiPath, "/quiet", "/norestart" -Wait
            
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
            
            Write-Host "  Azure CLI installed. Please restart PowerShell and run this script again." -ForegroundColor Yellow
            return
        } catch {
            Write-Host "  Failed to install Azure CLI. Please install manually from https://aka.ms/installazurecliwindows" -ForegroundColor Red
            return
        }
    }
} else {
    Write-Host "  Azure CLI is installed: $azVersion" -ForegroundColor Green
}

# ============================================================================
# Step 4: Write embedded scripts to install directory
# ============================================================================

Write-Host ""
Write-Host "Writing native host scripts..." -ForegroundColor Yellow

$adoScriptPath = Join-Path $InstallDir "ado_token_host.cjs"
$ghScriptPath = Join-Path $InstallDir "gh_token_host.cjs"

Set-Content -Path $adoScriptPath -Value $AdoTokenHostScript -Encoding UTF8
Write-Host "  $adoScriptPath" -ForegroundColor Green

Set-Content -Path $ghScriptPath -Value $GitHubTokenHostScript -Encoding UTF8
Write-Host "  $ghScriptPath" -ForegroundColor Green

# ============================================================================
# Step 5: Create batch wrappers
# ============================================================================

Write-Host ""
Write-Host "Creating batch wrappers..." -ForegroundColor Yellow

$adoWrapperPath = Join-Path $InstallDir "ado_token_host.bat"
$ghWrapperPath = Join-Path $InstallDir "gh_token_host.bat"

$adoWrapperContent = "@echo off`r`nnode `"$adoScriptPath`" %*"
Set-Content -Path $adoWrapperPath -Value $adoWrapperContent -Encoding ASCII
Write-Host "  $adoWrapperPath" -ForegroundColor Green

$ghWrapperContent = "@echo off`r`nnode `"$ghScriptPath`" %*"
Set-Content -Path $ghWrapperPath -Value $ghWrapperContent -Encoding ASCII
Write-Host "  $ghWrapperPath" -ForegroundColor Green

# ============================================================================
# Step 6: Create native messaging manifests
# ============================================================================

Write-Host ""
Write-Host "Creating native messaging manifests..." -ForegroundColor Yellow

$adoManifestPath = Join-Path $InstallDir "$AdoHostName.json"
$ghManifestPath = Join-Path $InstallDir "$GitHubHostName.json"

$adoManifest = @{
    name = $AdoHostName
    description = "HelloDev Native Host for Azure DevOps tokens"
    path = $adoWrapperPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 10
Set-Content -Path $adoManifestPath -Value $adoManifest -Encoding UTF8
Write-Host "  $adoManifestPath" -ForegroundColor Green

$ghManifest = @{
    name = $GitHubHostName
    description = "HelloDev Native Host for GitHub tokens via gh cli"
    path = $ghWrapperPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 10
Set-Content -Path $ghManifestPath -Value $ghManifest -Encoding UTF8
Write-Host "  $ghManifestPath" -ForegroundColor Green

# ============================================================================
# Step 7: Register in Windows Registry
# ============================================================================

Write-Host ""
Write-Host "Adding registry entries..." -ForegroundColor Yellow

# Chrome - ADO
$chromeAdoRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$AdoHostName"
New-Item -Path $chromeAdoRegPath -Force | Out-Null
Set-ItemProperty -Path $chromeAdoRegPath -Name "(Default)" -Value $adoManifestPath
Write-Host "  Chrome: $AdoHostName" -ForegroundColor Green

# Chrome - GitHub
$chromeGhRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$GitHubHostName"
New-Item -Path $chromeGhRegPath -Force | Out-Null
Set-ItemProperty -Path $chromeGhRegPath -Name "(Default)" -Value $ghManifestPath
Write-Host "  Chrome: $GitHubHostName" -ForegroundColor Green

# Edge - ADO
$edgeAdoRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$AdoHostName"
New-Item -Path $edgeAdoRegPath -Force | Out-Null
Set-ItemProperty -Path $edgeAdoRegPath -Name "(Default)" -Value $adoManifestPath
Write-Host "  Edge:   $AdoHostName" -ForegroundColor Green

# Edge - GitHub
$edgeGhRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$GitHubHostName"
New-Item -Path $edgeGhRegPath -Force | Out-Null
Set-ItemProperty -Path $edgeGhRegPath -Name "(Default)" -Value $ghManifestPath
Write-Host "  Edge:   $GitHubHostName" -ForegroundColor Green

# ============================================================================
# Step 8: Check Azure login status
# ============================================================================

Write-Host ""
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$loggedIn = $false
try {
    $account = & az account show 2>$null | ConvertFrom-Json
    if ($account) {
        $loggedIn = $true
        Write-Host "  Logged in as: $($account.user.name)" -ForegroundColor Green
    }
} catch {}

if (-not $loggedIn) {
    Write-Host "  Not logged in to Azure CLI." -ForegroundColor Yellow
    $login = Read-Host "  Would you like to login now? (Y/n)"
    if ($login -ne "n" -and $login -ne "N") {
        Write-Host "  Opening browser for Azure login..." -ForegroundColor Cyan
        & az login --allow-no-subscriptions
    }
}

# ============================================================================
# Done!
# ============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files installed to: $InstallDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Go back to HelloDev and click 'Check Connection'"
Write-Host "  2. If prompted, reload the HelloDev extension page"
Write-Host ""
