# Install script for HelloDev Native Messaging Host (Windows)
# Run this script in PowerShell

param(
    [string]$ExtensionId = "nhfaibfkboppjdaiiaocmdkahcmglgbh"
)

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Native host name
$HostName = "com.hellodev.ado"

# Paths
$HostScriptPath = Join-Path $ScriptDir "ado_token_host.js"
$ManifestPath = Join-Path $ScriptDir "$HostName.json"
$WrapperPath = Join-Path $ScriptDir "ado_token_host.bat"

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

# Create the batch wrapper for Node.js (Chrome needs an executable)
Write-Host ""
Write-Host "Creating native host wrapper..." -ForegroundColor Yellow
$wrapperContent = "@echo off`r`nnode `"$HostScriptPath`" %*"
Set-Content -Path $WrapperPath -Value $wrapperContent -Encoding ASCII
Write-Host "Created: $WrapperPath" -ForegroundColor Green

# Create the native messaging manifest
Write-Host ""
Write-Host "Creating native messaging manifest..." -ForegroundColor Yellow
$manifest = @{
    name = $HostName
    description = "HelloDev Native Host for Azure DevOps tokens"
    path = $WrapperPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 10

Set-Content -Path $ManifestPath -Value $manifest -Encoding UTF8
Write-Host "Created: $ManifestPath" -ForegroundColor Green

# Add registry entries
Write-Host ""
Write-Host "Adding registry entries..." -ForegroundColor Yellow

# Chrome
$chromeRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $chromeRegPath -Force | Out-Null
Set-ItemProperty -Path $chromeRegPath -Name "(Default)" -Value $ManifestPath
Write-Host "Added Chrome registry entry" -ForegroundColor Green

# Edge
$edgeRegPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
New-Item -Path $edgeRegPath -Force | Out-Null
Set-ItemProperty -Path $edgeRegPath -Name "(Default)" -Value $ManifestPath
Write-Host "Added Edge registry entry" -ForegroundColor Green

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
