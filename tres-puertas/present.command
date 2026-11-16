#!/bin/zsh
# macOS: double-click to start the local server (present + edit) and open the deck in the browser.
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then echo "Node.js 22+ is needed: https://nodejs.org"; read; exit 1; fi
node slaas/cli.mjs dev --open
