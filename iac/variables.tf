variable "app_name" {
  description = "The name of the application."
  type        = string
  default     = "Ghostfolio"
}

variable "project_id" {
  description = "The ID of the project in which to provision resources."
  type        = string
}

variable "region" {
  description = "The region in which to provision resources."
  type        = string
  default     = "asia-southeast1"
}
