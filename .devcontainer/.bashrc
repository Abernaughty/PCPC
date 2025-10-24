# ==============================================================================
# SHELL CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# History Settings
# ------------------------------------------------------------------------------
# Increase history size - keeps more commands in memory and file
export HISTSIZE=10000
export HISTFILESIZE=20000

# Don't put duplicate lines or lines starting with space in history
export HISTCONTROL=ignoreboth

# Append to history file instead of overwriting (important for multiple terminals)
shopt -s histappend

# ------------------------------------------------------------------------------
# Path Configuration
# ------------------------------------------------------------------------------
# Add local bin directories to PATH (checked in order)
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"

# Add other common tool paths
export PATH="$HOME/.npm-global/bin:$PATH"

# ------------------------------------------------------------------------------
# Environment Variables
# ------------------------------------------------------------------------------
# Set default editor (used by git, cron, etc.)
export EDITOR=vim
export VISUAL=vim

# Enable colors in terminal
export CLICOLOR=1
export LSCOLORS=GxFxCxDxBxegedabagaced

# Language settings
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# ------------------------------------------------------------------------------
# Git Configuration Aliases
# ------------------------------------------------------------------------------
alias gf='git fetch'
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph --decorate'
alias gd='git diff'
alias gco='git checkout'
alias gb='git branch'

# ------------------------------------------------------------------------------
# Directory Navigation
# ------------------------------------------------------------------------------
# Quick directory listings
alias ll='ls -alF'      # Long format, all files, classify
alias la='ls -A'        # All files except . and ..
alias l='ls -CF'        # Column format, classify

# Quick navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'

# Dev container specific
alias workspace='cd /workspace'
alias ws='cd /workspace'

# ------------------------------------------------------------------------------
# Helpful Utilities
# ------------------------------------------------------------------------------
# Make directories and navigate in one command
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Find files by name
ff() {
    find . -type f -name "*$1*"
}

# Grep through files
gg() {
    grep -r "$1" .
}

# Extract any archive type
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"    ;;
            *.tar.gz)    tar xzf "$1"    ;;
            *.bz2)       bunzip2 "$1"    ;;
            *.gz)        gunzip "$1"     ;;
            *.tar)       tar xf "$1"     ;;
            *.zip)       unzip "$1"      ;;
            *)           echo "'$1' cannot be extracted" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# ------------------------------------------------------------------------------
# Docker Aliases (useful in dev containers)
# ------------------------------------------------------------------------------
alias dps='docker ps'
alias dpa='docker ps -a'
alias di='docker images'
alias drm='docker rm'
alias drmi='docker rmi'

# ------------------------------------------------------------------------------
# Prompt Customization
# ------------------------------------------------------------------------------
# Parse git branch for prompt
parse_git_branch() {
    git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/(\1)/'
}

# Colorful prompt with git branch
# Format: [time] user@host:directory (git-branch) $
export PS1="\[\033[36m\][\t]\[\033[m\] \[\033[32m\]\u@\h\[\033[m\]:\[\033[33m\]\w\[\033[m\] \[\033[35m\]\$(parse_git_branch)\[\033[m\]\$ "

# ------------------------------------------------------------------------------
# Dev Container Detection
# ------------------------------------------------------------------------------
if [ -f /.dockerenv ]; then
    echo "🐳 Running in dev container"
    # Container-specific settings here
fi

# ------------------------------------------------------------------------------
# Load Additional Configs
# ------------------------------------------------------------------------------
# Source machine-specific configs if they exist
[ -f ~/.bashrc.local ] && source ~/.bashrc.local

# Load bash completion if available
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
fi

# Store Azure CLI profile inside a writable location instead of defaulting to $HOME/.azure
if [ -z "${AZURE_CONFIG_DIR:-}" ]; then
    for candidate in /workspace/.azure-cli /tmp/azure-cli "$HOME/.azure-config"; do
        if mkdir -p "$candidate" 2>/dev/null && [ -w "$candidate" ]; then
            export AZURE_CONFIG_DIR="$candidate"
            break
        fi
    done
fi
