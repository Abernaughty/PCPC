# PCPC CI Terraform Toolchain Image
# Contains: Terraform CLI, TFLint, Checkov, jq

FROM hashicorp/terraform:1.13.3

ENV DEBIAN_FRONTEND=noninteractive \
    TFLINT_VERSION=0.54.0 \
    TF_PLUGIN_CACHE_DIR=/root/.terraform.d/plugin-cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        jq \
        unzip \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /root/.terraform.d/plugin-cache

# Install TFLint (pinned)
RUN curl -fsSL -o /tmp/tflint.zip \
        https://github.com/terraform-linters/tflint/releases/download/v${TFLINT_VERSION}/tflint_linux_amd64.zip \
    && unzip /tmp/tflint.zip -d /usr/local/bin \
    && rm /tmp/tflint.zip \
    && chmod +x /usr/local/bin/tflint

# Install Checkov (pinned)
RUN pip3 install --no-cache-dir checkov==3.2.0

WORKDIR /workspace

CMD ["bash", "-lc", "terraform version && tflint --version && checkov --version"]

