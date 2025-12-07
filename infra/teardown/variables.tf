variable "app_db_password" {
  description = "Password for app database user"
  type        = string
  sensitive   = true
  default     = "change_me_in_production"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}