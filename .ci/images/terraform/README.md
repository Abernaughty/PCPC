pcpc-ci-terraform image

Purpose
- Provides a deterministic Terraform toolchain for CI validation (fmt, init, validate, tflint, checkov).

Notes
- Dockerfile will be added in Stage 2 using versions from ../../versions.yaml.
- Image will be pushed to ACR and consumed by digest in pipelines.

