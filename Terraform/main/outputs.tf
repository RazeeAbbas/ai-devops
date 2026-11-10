output "resource_group_name" {
  value = module.resource_group.name
}

output "vm_id" {
  value = module.compute.vm_id
}

output "public_ip" {
  value = module.networking.public_ip
}

output "dns_name" {
  value = module.dns.dns_name
}

output "dns_record_ip" {
  value = module.dns.dns_record_ip
}

output "admin_username" {
  value = var.admin_username
}

output "admin_password" {
  value     = module.security.admin_password
  sensitive = true
}

output "name_servers" {
  value = module.dns.name_server
}
