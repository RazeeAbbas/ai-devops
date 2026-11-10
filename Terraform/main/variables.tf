variable "subscription_id" {
  type = string
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "location" {
  type    = string
  default = "East US"
}

variable "vm_size" {
  type    = string
  default = "Standard_B1s"
}

variable "admin_username" {
  type    = string
  default = "azureadmin"
}

variable "resource_group_name" {
  type = string
}

variable "vm_name" {
  type = string
}

variable "dns_name" {
  type = string
}
