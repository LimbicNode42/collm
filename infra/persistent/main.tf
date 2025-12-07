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
    key            = "persistent/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collm-terraform-lock"
  }
}

provider "aws" {
  region = "us-east-1"
}

# Data sources for current AWS context
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name   = "collm"
  region = "us-east-1"

  tags = {
    Project     = "collm"
    Environment = "dev"
    Workspace   = "persistent"
  }
}