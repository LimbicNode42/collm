module "ecs" {
  source  = "terraform-aws-modules/ecs/aws"
  version = "~> 6.0"

  cluster_name = "${local.name}-cluster"

  default_capacity_provider_strategy = {
    FARGATE = {
      weight = 100
    }
    FARGATE_SPOT = {
      weight = 0
    }
  }

  tags = local.tags
}

resource "aws_ecr_repository" "app" {
  name                 = "${local.name}-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}
