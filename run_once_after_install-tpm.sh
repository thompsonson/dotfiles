#!/bin/bash
# Install Tmux Plugin Manager if not present
if command -v tmux >/dev/null 2>&1; then
  if [ ! -d ~/.tmux/plugins/tpm ]; then
    echo 'Installing Tmux Plugin Manager (TPM)...'
    git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
    echo 'TPM installed. Plugins will install on first tmux start (or press prefix + I).'
  fi
fi
