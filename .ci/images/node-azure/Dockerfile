# PCPC CI Node.js + Azure CLI Combined Image
# Contains: Node.js 22, npm, Azure CLI, common utilities
# Used for: Build jobs and Azure deployment operations

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies required for Azure CLI
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        docker.io \
        git \
        jq \
        gnupg \
        lsb-release \
        python3 \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Install Azure CLI using official installation script
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Verify installations
RUN echo "Verifying installed tools..." \
    && node --version \
    && npm --version \
    && az --version \
    && echo "All tools verified successfully"

WORKDIR /workspace

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Keep container alive for CI job steps
CMD ["bash", "-lc", "tail -f /dev/null"]
