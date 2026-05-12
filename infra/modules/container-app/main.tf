# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "container-app"
    },
    var.tags
  )

  # Mirror function-app's hyphen-to-underscore transform for app_settings keys.
  # Azure Key Vault secret names use hyphens, but Node.js process.env.* lookups
  # use underscores; the transform happens at the gateway so callers can pass
  # either form.
  transformed_app_settings = {
    for key, value in var.app_settings :
    replace(key, "-", "_") => value
  }

  # Same transform for secret keys.
  transformed_secret_settings = {
    for key, value in var.secret_settings :
    replace(key, "-", "_") => value
  }

  # Secret names in the Container App resource must be lowercase + hyphens.
  # The env var name keeps the transformed (underscore) form; the secret
  # ref name is a lowercased-hyphen form so it satisfies the resource's
  # name validation. We build both views here.
  secret_refs = {
    for key, value in local.transformed_secret_settings :
    key => {
      env_name    = key
      secret_name = lower(replace(key, "_", "-"))
      value       = value
    }
  }

  full_image_reference = "${var.acr_login_server}/${var.image_repository}:${var.image_tag}"
}

# -----------------------------------------------------------------------------
# USER-ASSIGNED MANAGED IDENTITY
#
# Used by the Container App to pull from ACR. Separate from the System
# identity Path B's Function App uses — UAMI is the production-correct
# pattern for ACR pulls (admin-enabled ACR would be a scanner finding).
# -----------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "this" {
  name                = "${var.name}-uami"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.common_tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.acr_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.this.principal_id
}

# -----------------------------------------------------------------------------
# CONTAINER APPS ENVIRONMENT
#
# Consumes the caller-supplied Log Analytics workspace so Path B (Function
# App / App Insights) and Path C (this Container App) write traces to the
# same workspace and are queryable side-by-side.
# -----------------------------------------------------------------------------

resource "azurerm_container_app_environment" "this" {
  name                       = "${var.name}-env"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.log_analytics_workspace_id

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CONTAINER APP
# -----------------------------------------------------------------------------

resource "azurerm_container_app" "this" {
  name                         = var.name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.this.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.this.id
  }

  # Each secret_settings entry becomes one `secret` block here AND one
  # `env { name=..., secret_name=... }` block in the template below.
  dynamic "secret" {
    for_each = local.secret_refs
    content {
      name  = secret.value.secret_name
      value = secret.value.value
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    http_scale_rule {
      name                = "http-scale"
      concurrent_requests = var.http_concurrency
    }

    container {
      name   = "functions"
      image  = local.full_image_reference
      cpu    = var.cpu
      memory = var.memory

      # Non-secret env vars (plain value)
      dynamic "env" {
        for_each = local.transformed_app_settings
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret env vars (referenced by secret_name from the secret blocks above)
      dynamic "env" {
        for_each = local.secret_refs
        content {
          name        = env.value.env_name
          secret_name = env.value.secret_name
        }
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }

    cors {
      allowed_origins    = var.cors_allowed_origins
      allowed_methods    = var.cors_allowed_methods
      allowed_headers    = var.cors_allowed_headers
      exposed_headers    = []
      max_age_in_seconds = var.cors_max_age_in_seconds
    }
  }

  tags = local.common_tags

  depends_on = [
    azurerm_role_assignment.acr_pull,
  ]

  lifecycle {
    # Pipeline-managed: ADO's deploy-aca.yml runs `az containerapp update
    # --image <new_sha>` post-Terraform-apply to roll new revisions. Terraform
    # owns the resource shape; the pipeline owns the image tag pin. Without
    # this ignore, every CD run would either flap the image back to the
    # `image_tag` variable's default or force re-runs to bump the variable.
    ignore_changes = [
      template[0].container[0].image,
    ]
  }
}
