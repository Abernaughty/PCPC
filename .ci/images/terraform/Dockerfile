# PCPC CI Terraform Toolchain Image
# Contains: Terraform CLI, TFLint, Checkov, jq

# Use Debian base so we can install required packages (apt-get available)
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TERRAFORM_VERSION=1.13.3 \
    TFLINT_VERSION=0.54.0 \
    TF_PLUGIN_CACHE_DIR=/opt/tf-plugin-cache

# OS packages and tini for sane PID 1 in CI containers
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        jq \
        unzip \
        python3 \
        python3-pip \
        python3-venv \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p "${TF_PLUGIN_CACHE_DIR}" \
    && chmod 0777 "${TF_PLUGIN_CACHE_DIR}"

# Install Terraform (pinned)
RUN curl -fsSL -o /tmp/terraform.zip \
        https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip

# Install TFLint (pinned)
RUN curl -fsSL -o /tmp/tflint.zip \
        https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/tflint_linux_amd64.zip \
    && unzip /tmp/tflint.zip -d /usr/local/bin \
    && rm /tmp/tflint.zip \
    && chmod +x /usr/local/bin/tflint

# Install Checkov (pinned) in isolated virtual environment to satisfy Debian PEP 668 policy
RUN python3 -m venv /opt/checkov \
    && /opt/checkov/bin/pip install --no-cache-dir checkov==3.2.0 \
    && ln -sf /opt/checkov/bin/checkov /usr/local/bin/checkov

WORKDIR /workspace

# Use tini as entrypoint and keep container alive for CI job steps
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "-lc", "tail -f /dev/null"]
