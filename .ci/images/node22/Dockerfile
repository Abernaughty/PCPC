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
        libxml2-utils \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Install Spectral CLI (OpenAPI linter)
RUN npm install -g @stoplight/spectral-cli@${SPECTRAL_VERSION}

WORKDIR /workspace

ENTRYPOINT ["/usr/bin/tini", "--"]
# Keep container alive so CI agents can execute multiple steps within the job
CMD ["bash", "-lc", "tail -f /dev/null"]
