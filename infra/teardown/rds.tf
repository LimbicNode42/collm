module "db" {
  source = "terraform-aws-modules/rds/aws"

  identifier = "${local.name}-db"

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = "db.t4g.micro" # Free tier eligible-ish

  allocated_storage     = 20
  max_allocated_storage = 100

  db_name                       = "collm"
  username                      = "collm_admin"
  manage_master_user_password   = true
  master_user_secret_kms_key_id = null # Use default KMS key
  port                          = 5432

  # DB subnet group
  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets
  vpc_security_group_ids = [module.security_group.security_group_id]

  maintenance_window = "Mon:00:00-Mon:03:00"
  backup_window      = "03:00-06:00"

  # Disable deletion protection for dev
  deletion_protection = false
  skip_final_snapshot = true

  tags = local.tags
}

module "security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 5.0"

  name        = "${local.name}-db-sg"
  description = "PostgreSQL security group"
  vpc_id      = module.vpc.vpc_id

  # Ingress from within VPC (EKS nodes)
  ingress_with_cidr_blocks = [
    {
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      description = "PostgreSQL access from within VPC"
      cidr_blocks = module.vpc.vpc_cidr_block
    },
  ]

  tags = local.tags
}

# Output the secret ARN for ECS tasks to access
output "db_master_user_secret_arn" {
  description = "ARN of the RDS master user secret in Secrets Manager"
  value       = module.db.db_instance_master_user_secret_arn
  sensitive   = true
}