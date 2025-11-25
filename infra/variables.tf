variable "db_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}

variable "app_db_password" {
  description = "Password for the application database user"
  type        = string
  sensitive   = true
}