terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Local state for development
  # backend "s3" { ... }

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
  }
}
