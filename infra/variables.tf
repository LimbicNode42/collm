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

variable "image_tag" {
  description = "Tag for the Docker images"
  type        = string
  default     = "latest"
}

variable "openai_api_key" {
  description = "OpenAI API key for LLM integration"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for LLM integration"
  type        = string
  sensitive   = true
}

variable "google_api_key" {
  description = "Google AI API key for Gemini models"
  type        = string
  sensitive   = true
}