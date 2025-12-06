# Outputs for the persistent workspace - used by teardown workspace
output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = aws_iam_role.github_actions.arn
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret containing LLM API keys"
  value       = aws_secretsmanager_secret.llm_keys.arn
}

output "ecr_repositories" {
  description = "Map of ECR repository URLs"
  value = {
    message_service = aws_ecr_repository.message_service.repository_url
    user_service    = aws_ecr_repository.user_service.repository_url
    core_service    = aws_ecr_repository.core_service.repository_url
    migrator        = aws_ecr_repository.migrator.repository_url
    web             = aws_ecr_repository.web.repository_url
  }
}

output "secrets_access_policy_arn" {
  description = "ARN of the IAM policy for secrets access"
  value       = aws_iam_policy.secrets_access.arn
}