terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state in S3 with DynamoDB locking
  backend "s3" {
    bucket         = "collm-terraform-state-prod-001"
    key            = "teardown/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collm-terraform-lock"
  }
}

provider "aws" {
  region = "us-east-1"
}

# Data source to get persistent workspace outputs
data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "collm-terraform-state-prod-001"
    key    = "persistent/terraform.tfstate"
    region = "us-east-1"
  }
}

locals {
  name   = "collm"
  region = "us-east-1"

  tags = {
    Project     = "collm"
    Environment = "dev"
    Workspace   = "teardown"
  }

  # Reference persistent resources
  github_actions_role_arn = data.terraform_remote_state.persistent.outputs.github_actions_role_arn
  ecs_execution_role_arn  = data.terraform_remote_state.persistent.outputs.ecs_execution_role_arn
  ecs_task_role_arn       = data.terraform_remote_state.persistent.outputs.ecs_task_role_arn
  secrets_manager_arn     = data.terraform_remote_state.persistent.outputs.secrets_manager_arn
  ecr_repositories        = data.terraform_remote_state.persistent.outputs.ecr_repositories
}