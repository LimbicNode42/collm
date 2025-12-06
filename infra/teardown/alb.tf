resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = false

  tags = local.tags
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Allow inbound traffic"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }

  tags = local.tags
}

resource "aws_lb_target_group" "user_service" {
  name        = "${local.name}-user-tg"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }

  tags = local.tags
}

resource "aws_lb_target_group" "message_service" {
  name        = "${local.name}-message-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }

  tags = local.tags
}

resource "aws_lb_target_group" "core_service" {
  name        = "${local.name}-core-tg"
  port        = 3003
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  tags = local.tags
}

# Rule to route /api/user/* to user-service
resource "aws_lb_listener_rule" "user_service_users" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 110

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.user_service.arn
  }

  condition {
    path_pattern {
      values = ["/users/*"]
    }
  }
}

resource "aws_lb_listener_rule" "user_service_auth" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 111

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.user_service.arn
  }

  condition {
    path_pattern {
      values = ["/register", "/login"]
    }
  }

  condition {
    http_request_method {
      values = ["POST"]
    }
  }
}

resource "aws_lb_listener_rule" "message_service" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 120

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.message_service.arn
  }

  condition {
    path_pattern {
      values = ["/message", "/queue/*"]
    }
  }
}

resource "aws_lb_listener_rule" "message_service_get" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 121

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.message_service.arn
  }

  condition {
    path_pattern {
      values = ["/message/*"]
    }
  }

  condition {
    http_request_method {
      values = ["GET"]
    }
  }
}

resource "aws_lb_listener_rule" "core_service_nodes" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 130

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.core_service.arn
  }

  condition {
    path_pattern {
      values = ["/nodes", "/nodes/*"]
    }
  }
}