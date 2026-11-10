locals {
  normalized_vm_name = substr(lower(replace(var.vm_name, "/[^a-z0-9-]/", "-")), 0, 15)
  dns_zone_name      = "workshop.local"
  hostname           = var.dns_name
  common_tags = {
    environment = var.environment
    managed_by  = "terraform"
  }
}
