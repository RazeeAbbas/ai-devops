variable "dns_name" {
  type = string
}

variable "dns_zone_name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "public_ip" {
  type = string
}

variable "tags" {
  type = map(string)
}
