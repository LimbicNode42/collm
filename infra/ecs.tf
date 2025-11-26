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

# IAM Roles
resource "aws_iam_role" "ecs_execution_role" {
  name = "${local.name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${local.name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = local.tags
}

# Allow Task to access SQS
resource "aws_iam_role_policy" "ecs_task_sqs_policy" {
  name = "${local.name}-ecs-task-sqs-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.adjudication_queue.arn,
          aws_sqs_queue.adjudication_dlq.arn
        ]
      }
    ]
  })
}

# Allow Task to use SSM for ECS Exec
resource "aws_iam_role_policy" "ecs_task_ssm_policy" {
  name = "${local.name}-ecs-task-ssm-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name}-ecs-tasks-sg"
  description = "Allow outbound access"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Allow HTTP from ALB"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_ecr_repository" "message_service" {
  name                 = "${local.name}-message-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "user_service" {
  name                 = "${local.name}-user-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "core_service" {
  name                 = "${local.name}-core-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "migrator" {
  name                 = "${local.name}-migrator"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_ecr_repository" "web" {
  name                 = "${local.name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "message_service" {
  name              = "/ecs/${local.name}-message-service"
  retention_in_days = 7
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "user_service" {
  name              = "/ecs/${local.name}-user-service"
  retention_in_days = 7
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "core_service" {
  name              = "/ecs/${local.name}-core-service"
  retention_in_days = 7
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "migrator" {
  name              = "/ecs/${local.name}-migrator"
  retention_in_days = 7
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name}-web"
  retention_in_days = 7
  tags              = local.tags
}

resource "aws_ecs_task_definition" "message_service" {
  family                   = "${local.name}-message-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "message-service"
      image = "${aws_ecr_repository.message_service.repository_url}:${var.image_tag}"
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
        }
      ]
      environment = [
        {
          name  = "SQS_QUEUE_URL"
          value = aws_sqs_queue.adjudication_queue.url
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${module.db.db_instance_username}:${urlencode(var.db_password)}@${module.db.db_instance_endpoint}/collm_core?sslmode=no-verify"
        },
        {
          name  = "AWS_REGION"
          value = local.region
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.message_service.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "message_service" {
  name            = "${local.name}-message-service"
  cluster         = module.ecs.cluster_id
  task_definition = aws_ecs_task_definition.message_service.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.message_service.arn
    container_name   = "message-service"
    container_port   = 3001
  }

  tags = local.tags
}

resource "aws_ecs_task_definition" "user_service" {
  family                   = "${local.name}-user-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "user-service"
      image = "${aws_ecr_repository.user_service.repository_url}:${var.image_tag}"
      portMappings = [
        {
          containerPort = 3002
          hostPort      = 3002
        }
      ]
      environment = [
        {
          name  = "DATABASE_URL"
          value = "postgresql://user_service_app:${urlencode(var.app_db_password)}@${module.db.db_instance_endpoint}/collm_users?sslmode=no-verify"
        },
        {
          name  = "DATABASE_URL_USER"
          value = "postgresql://user_service_app:${urlencode(var.app_db_password)}@${module.db.db_instance_endpoint}/collm_users?sslmode=no-verify"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.user_service.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "user_service" {
  name                   = "${local.name}-user-service"
  cluster                = module.ecs.cluster_id
  task_definition        = aws_ecs_task_definition.user_service.arn
  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.user_service.arn
    container_name   = "user-service"
    container_port   = 3002
  }

  tags = local.tags
}

resource "aws_ecs_task_definition" "core_service" {
  family                   = "${local.name}-core-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "core-service"
      image = "${aws_ecr_repository.core_service.repository_url}:${var.image_tag}"
      environment = [
        {
          name  = "SQS_QUEUE_URL"
          value = aws_sqs_queue.adjudication_queue.url
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${module.db.db_instance_username}:${urlencode(var.db_password)}@${module.db.db_instance_endpoint}/collm_core?sslmode=no-verify"
        },
        {
          name  = "AWS_REGION"
          value = local.region
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.core_service.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "core_service" {
  name            = "${local.name}-core-service"
  cluster         = module.ecs.cluster_id
  task_definition = aws_ecs_task_definition.core_service.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  tags = local.tags
}

resource "aws_ecs_task_definition" "migrator" {
  family                   = "${local.name}-migrator"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "migrator"
      image = "${aws_ecr_repository.migrator.repository_url}:${var.image_tag}"
      environment = [
        {
          name  = "DATABASE_URL_USER"
          value = "postgresql://${module.db.db_instance_username}:${urlencode(var.db_password)}@${module.db.db_instance_endpoint}/collm_users?sslmode=no-verify"
        },
        {
          name  = "DATABASE_URL_CORE"
          value = "postgresql://${module.db.db_instance_username}:${urlencode(var.db_password)}@${module.db.db_instance_endpoint}/collm_core?sslmode=no-verify"
        },
        {
          name  = "APP_USER_PASSWORD"
          value = var.app_db_password
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migrator.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "migrator" {
  name            = "${local.name}-migrator"
  cluster         = module.ecs.cluster_id
  task_definition = aws_ecs_task_definition.migrator.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  tags = local.tags
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "web"
      image = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
        }
      ]
      environment = [
        {
          name  = "NEXT_PUBLIC_API_URL"
          value = "" # Relative path, handled by CloudFront routing
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "web" {
  name            = "${local.name}-web"
  cluster         = module.ecs.cluster_id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  tags = local.tags
}

