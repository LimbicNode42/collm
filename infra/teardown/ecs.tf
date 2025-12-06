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

# CloudWatch Log Groups
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

# IAM policy attachments for ECS tasks (referencing persistent resources)
resource "aws_iam_role_policy" "ecs_task_sqs_policy" {
  name = "${local.name}-ecs-task-sqs-policy"
  role = basename(local.ecs_task_role_arn)

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

resource "aws_iam_role_policy" "ecs_task_ssm_policy" {
  name = "${local.name}-ecs-task-ssm-policy"
  role = basename(local.ecs_task_role_arn)

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

resource "aws_iam_role_policy" "ecs_execution_secrets_policy" {
  name = "${local.name}-ecs-execution-secrets-policy"
  role = basename(local.ecs_execution_role_arn)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          local.secrets_manager_arn
        ]
      }
    ]
  })
}

# Message Service
resource "aws_ecs_task_definition" "message_service" {
  family                   = "${local.name}-message-service"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = local.ecs_execution_role_arn
  task_role_arn            = local.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "message-service"
      image = "${local.ecr_repositories.message_service}:${var.image_tag}"
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
          name  = "DATABASE_URL_CORE"
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