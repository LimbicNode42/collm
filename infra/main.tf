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
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collm-terraform-lock"
  }

}

provider "aws" {
  region = "us-east-1"
}

locals {
  name   = "collm"
  region = "us-east-1"

  tags = {
    Project     = "collm"
    Environment = "dev"
    ManagedBy   = "opentofu"
    Repository  = "https://github.com/LimbicNode42/collm"
  }
}

variable "db_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}
