# Install script for HelloDev Native Messaging Host (Windows)
# Run this script in PowerShell

param(
    [string]$ExtensionId = "nhfaibfkboppjdaiiaocmdkahcmglgbh"
)

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Native host names
$AdoHostName = "com.hellodev.ado"
$GitHubHostName = "com.hellodev.github"

# ADO paths
$AdoHostScriptPath = Join-Path $ScriptDir "ado_token_host.js"
$AdoManifestPath = Join-Path $ScriptDir "$AdoHostName.json"
$AdoWrapperPath = Join-Path $ScriptDir "ado_token_host.bat"

# GitHub paths
$GitHubHostScriptPath = Join-Path $ScriptDir "gh_token_host.js"
$GitHubManifestPath = Join-Path $ScriptDir "$GitHubHostName.json"
$GitHubWrapperPath = Join-Path $ScriptDir "gh_token_host.bat"

Write-Host "HelloDev Native Host Installer" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
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
        
        # Verify installation
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Host "Node.js $nodeVersion installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "Node.js installed but not in PATH. Please restart PowerShell and run this script again." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Failed to install Node.js via winget. Please install manually from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Node.js $nodeVersion is installed." -ForegroundColor Green
}

# Check if Azure CLI is installed
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
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        # Verify installation
        $azVersion = & az --version 2>$null | Select-Object -First 1
        if ($azVersion) {
            Write-Host "Azure CLI installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "Azure CLI installed but not in PATH. Please restart PowerShell and run this script again." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Failed to install Azure CLI via winget." -ForegroundColor Red
        Write-Host "Trying MSI installer..." -ForegroundColor Yellow
        
        try {
            $msiUrl = "https://aka.ms/installazurecliwindows"
            $msiPath = Join-Path $env:TEMP "AzureCLI.msi"
            
            Write-Host "Downloading Azure CLI installer..."
            Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath
            
            Write-Host "Running installer (this may take a few minutes)..."
            Start-Process msiexec.exe -ArgumentList "/i", $msiPath, "/quiet", "/norestart" -Wait
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            
            # Clean up
            Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
            
            Write-Host "Azure CLI installed. Please restart PowerShell and run this script again." -ForegroundColor Yellow
            exit 0
        } catch {
            Write-Host "Failed to install Azure CLI. Please install manually from https://aka.ms/installazurecliwindows" -ForegroundColor Red
            exit 1
        }
    }
} else {
    Write-Host "Azure CLI is installed: $azVersion" -ForegroundColor Green
}

# Create the batch wrappers for Node.js (Chrome needs an executable)
Write-Host ""
Write-Host "Creating native host wrappers..." -ForegroundColor Yellow

$adoWrapperContent = "@echo off`r`nnode `"$AdoHostScriptPath`" %*"
Set-Content -Path $AdoWrapperPath -Value $adoWrapperContent -Encoding ASCII
Write-Host "Created: $AdoWrapperPath" -ForegroundColor Green

$ghWrapperContent = "@echo off`r`nnode `"$GitHubHostScriptPath`" %*"
Set-Content -Path $GitHubWrapperPath -Value $ghWrapperContent -Encoding ASCII
Write-Host "Created: $GitHubWrapperPath" -ForegroundColor Green

# Create the native messaging manifests
Write-Host ""
Write-Host "Creating native messaging manifests..." -ForegroundColor Yellow

$adoManifest = @{
    name = $AdoHostName
    description = "HelloDev Native Host for Azure DevOps tokens"
    path = $AdoWrapperPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 10
Set-Content -Path $AdoManifestPath -Value $adoManifest -Encoding UTF8
Write-Host "Created: $AdoManifestPath" -ForegroundColor Green

$ghManifest = @{
    name = $GitHubHostName
    description = "HelloDev Native Host for GitHub tokens via gh cli"
    path = $GitHubWrapperPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 10
Set-Content -Path $GitHubManifestPath -Value $ghManifest -Encoding UTF8
Write-Host "Created: $GitHubManifestPath" -ForegroundColor Green

# Add registry entries
Write-Host ""
Write-Host "Adding registry entries..." -ForegroundColor Yellow

# Chrome - ADO
$chromeAdoRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$AdoHostName"
New-Item -Path $chromeAdoRegPath -Force | Out-Null
Set-ItemProperty -Path $chromeAdoRegPath -Name "(Default)" -Value $AdoManifestPath
Write-Host "Added Chrome registry entry for ADO host" -ForegroundColor Green

# Chrome - GitHub
$chromeGhRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$GitHubHostName"
New-Item -Path $chromeGhRegPath -Force | Out-Null
Set-ItemProperty -Path $chromeGhRegPath -Name "(Default)" -Value $GitHubManifestPath
Write-Host "Added Chrome registry entry for GitHub host" -ForegroundColor Green

# Edge - ADO
$edgeAdoRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$AdoHostName"
New-Item -Path $edgeAdoRegPath -Force | Out-Null
Set-ItemProperty -Path $edgeAdoRegPath -Name "(Default)" -Value $AdoManifestPath
Write-Host "Added Edge registry entry for ADO host" -ForegroundColor Green

# Edge - GitHub
$edgeGhRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$GitHubHostName"
New-Item -Path $edgeGhRegPath -Force | Out-Null
Set-ItemProperty -Path $edgeGhRegPath -Name "(Default)" -Value $GitHubManifestPath
Write-Host "Added Edge registry entry for GitHub host" -ForegroundColor Green

# Check if logged in to Azure
Write-Host ""
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$loggedIn = $false
try {
    $account = & az account show 2>$null | ConvertFrom-Json
    if ($account) {
        $loggedIn = $true
        Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
    }
} catch {}

if (-not $loggedIn) {
    Write-Host "Not logged in to Azure CLI." -ForegroundColor Yellow
    $login = Read-Host "Would you like to login now? (Y/n)"
    if ($login -ne "n" -and $login -ne "N") {
        Write-Host "Opening browser for Azure login..." -ForegroundColor Cyan
        & az login --allow-no-subscriptions
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Reload the HelloDev extension in chrome://extensions"
Write-Host "2. Add an ADO PR widget and configure your organization/project"
Write-Host ""
