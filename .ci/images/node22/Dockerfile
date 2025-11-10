# PCPC CI Node 22 Toolchain Image
# Contains: Node 22 LTS, Git, Spectral CLI (pinned)

FROM node:22-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    SPECTRAL_VERSION=6.11.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        openssl \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Install Spectral CLI (OpenAPI linter)
RUN npm install -g @stoplight/spectral-cli@${SPECTRAL_VERSION}

WORKDIR /workspace

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "-lc", "node --version && npm --version && spectral --version"]

