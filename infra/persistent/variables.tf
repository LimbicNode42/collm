variable "openai_api_key" {
  description = "OpenAI API Key for LLM access"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API Key for Claude access"
  type        = string
  sensitive   = true
}

variable "google_api_key" {
  description = "Google API Key for Gemini access"
  type        = string
  sensitive   = true
}