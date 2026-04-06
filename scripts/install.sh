#!/usr/bin/env sh
set -e

# SEOAgent installer
# Usage: curl -fsSL https://raw.githubusercontent.com/yagomp/seoagent/main/scripts/install.sh | sh

REQUIRED_NODE_MAJOR=20
SEOAGENT_VERSION="latest"

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

bold ""
bold "  SEOAgent installer"
bold ""

# ── 1. Check for Node.js ──────────────────────────────────────────────────────

node_ok=0

if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -e "process.stdout.write(String(process.version.replace('v','').split('.')[0]))")
  if [ "$NODE_VERSION" -ge "$REQUIRED_NODE_MAJOR" ] 2>/dev/null; then
    green "  ✓ Node.js $(node --version) found"
    node_ok=1
  else
    red "  ✗ Node.js $(node --version) found but >= v${REQUIRED_NODE_MAJOR} is required"
  fi
else
  red "  ✗ Node.js not found"
fi

# ── 2. Install Node.js if needed ─────────────────────────────────────────────

if [ "$node_ok" -eq 0 ]; then
  cyan ""
  cyan "  Installing Node.js v${REQUIRED_NODE_MAJOR} via nvm..."
  cyan ""

  # Install nvm if not present
  if ! command -v nvm >/dev/null 2>&1 && [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | sh
  fi

  # Load nvm into current shell
  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  if ! command -v nvm >/dev/null 2>&1; then
    red ""
    red "  Could not load nvm. Please install Node.js >= v${REQUIRED_NODE_MAJOR} manually:"
    red "  https://nodejs.org/en/download"
    red ""
    exit 1
  fi

  nvm install "$REQUIRED_NODE_MAJOR"
  nvm use "$REQUIRED_NODE_MAJOR"
  nvm alias default "$REQUIRED_NODE_MAJOR"
  green "  ✓ Node.js $(node --version) installed"
fi

# ── 3. Install SEOAgent ───────────────────────────────────────────────────────

cyan ""
cyan "  Installing seoagent..."
cyan ""

npm install -g "@seoagent/cli@${SEOAGENT_VERSION}"

# ── 4. Verify ─────────────────────────────────────────────────────────────────

if command -v seoagent >/dev/null 2>&1; then
  green ""
  green "  ✓ seoagent $(seoagent --version) installed successfully"
  green ""
  bold "  Next steps:"
  printf "    seoagent project add mysite --domain example.com --niche \"your niche\"\n"
  printf "    seoagent config set dataforseo.login YOUR_LOGIN\n"
  printf "    seoagent config set dataforseo.password YOUR_PASSWORD\n"
  printf "    seoagent audit crawl\n"
  printf "    seoagent strategy generate\n"
  printf "\n"
  printf "  Docs: https://github.com/yagomp/seoagent\n"
  printf "\n"
else
  red ""
  red "  Installation completed but 'seoagent' command not found in PATH."
  red "  You may need to restart your terminal or run: source ~/.bashrc"
  red ""
  exit 1
fi
