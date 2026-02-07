#!/bin/bash
# Install script for HelloDev Native Messaging Host (macOS/Linux)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Native host name
HOST_NAME="com.hellodev.ado"

# Path to the native host script
HOST_PATH="$SCRIPT_DIR/ado_token_host.js"

# Extension ID - update this after loading the extension
EXTENSION_ID="${1:-nhfaibfkboppjdaiiaocmdkahcmglgbh}"

echo -e "${CYAN}HelloDev Native Host Installer${NC}"
echo -e "${CYAN}==============================${NC}"
echo ""

# Check if Node.js is installed
echo -e "${YELLOW}Checking for Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}Node.js $NODE_VERSION is installed.${NC}"
else
    echo -e "${YELLOW}Node.js is not installed. Installing...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use Homebrew
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo -e "${YELLOW}Homebrew not found. Installing Homebrew first...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            brew install node
        fi
    else
        # Linux - try various package managers
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y nodejs npm
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y nodejs npm
        elif command -v yum &> /dev/null; then
            sudo yum install -y nodejs npm
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm nodejs npm
        else
            echo -e "${RED}Could not detect package manager. Please install Node.js manually from https://nodejs.org${NC}"
            exit 1
        fi
    fi
    
    if command -v node &> /dev/null; then
        echo -e "${GREEN}Node.js installed successfully!${NC}"
    else
        echo -e "${RED}Failed to install Node.js. Please install manually from https://nodejs.org${NC}"
        exit 1
    fi
fi

# Check if Azure CLI is installed
echo ""
echo -e "${YELLOW}Checking for Azure CLI...${NC}"
if command -v az &> /dev/null; then
    AZ_VERSION=$(az --version 2>/dev/null | head -1)
    echo -e "${GREEN}Azure CLI is installed: $AZ_VERSION${NC}"
else
    echo -e "${YELLOW}Azure CLI is not installed. Installing...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use Homebrew
        if command -v brew &> /dev/null; then
            brew install azure-cli
        else
            echo -e "${RED}Homebrew not found. Please install Azure CLI manually.${NC}"
            echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-macos"
            exit 1
        fi
    else
        # Linux - use Microsoft's install script
        echo -e "${YELLOW}Running Microsoft's Azure CLI install script...${NC}"
        curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    fi
    
    if command -v az &> /dev/null; then
        echo -e "${GREEN}Azure CLI installed successfully!${NC}"
    else
        echo -e "${RED}Failed to install Azure CLI.${NC}"
        echo "Please install manually: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
fi

# Make the host script executable
chmod +x "$HOST_PATH"

# Determine the target directory based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_TARGET_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
else
    # Linux
    CHROME_TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_TARGET_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
fi

# Create the manifest content
create_manifest() {
    cat << EOF
{
  "name": "$HOST_NAME",
  "description": "HelloDev Native Host for Azure DevOps tokens",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
}

# Install for Chrome
echo ""
echo -e "${YELLOW}Creating native messaging manifest for Chrome...${NC}"
mkdir -p "$CHROME_TARGET_DIR"
create_manifest > "$CHROME_TARGET_DIR/$HOST_NAME.json"
echo -e "${GREEN}Created: $CHROME_TARGET_DIR/$HOST_NAME.json${NC}"

# Install for Edge
echo -e "${YELLOW}Creating native messaging manifest for Edge...${NC}"
mkdir -p "$EDGE_TARGET_DIR"
create_manifest > "$EDGE_TARGET_DIR/$HOST_NAME.json"
echo -e "${GREEN}Created: $EDGE_TARGET_DIR/$HOST_NAME.json${NC}"

# Check if logged in to Azure
echo ""
echo -e "${YELLOW}Checking Azure login status...${NC}"
if az account show &> /dev/null; then
    ACCOUNT=$(az account show --query user.name -o tsv 2>/dev/null)
    echo -e "${GREEN}Logged in as: $ACCOUNT${NC}"
else
    echo -e "${YELLOW}Not logged in to Azure CLI.${NC}"
    read -p "Would you like to login now? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${CYAN}Opening browser for Azure login...${NC}"
        az login --allow-no-subscriptions
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Reload the HelloDev extension in chrome://extensions"
echo "2. Add an ADO PR widget and configure your organization/project"
echo ""
