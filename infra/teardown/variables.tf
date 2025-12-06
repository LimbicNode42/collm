variable "db_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}

variable "app_db_password" {
  description = "Password for app database user"
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}