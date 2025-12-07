# Secrets Manager for LLM API Keys
resource "aws_secretsmanager_secret" "llm_keys" {
  name                    = "${local.name}-llm-keys-v2"
  description             = "API keys for LLM providers (OpenAI, Anthropic, etc.)"
  recovery_window_in_days = 7

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "llm_keys" {
  secret_id = aws_secretsmanager_secret.llm_keys.id
  secret_string = jsonencode({
    OPENAI_API_KEY    = var.openai_api_key
    ANTHROPIC_API_KEY = var.anthropic_api_key
    GOOGLE_API_KEY    = var.google_api_key
  })
}

# IAM policy to allow ECS tasks to read secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "${local.name}-secrets-access"
  description = "Allow ECS tasks to read LLM API keys and RDS credentials from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.llm_keys.arn,
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:rds-db-credentials/*"
        ]
      }
    ]
  })

  tags = local.tags
}