output "dns_name" {
  value = var.dns_name
}

output "dns_record_ip" {
  value = one(azurerm_dns_a_record.vm_dns.records)
}

output "name_server" {
  value = azurerm_dns_zone.zone.name_servers
}
