output "nsg_id" {
  value = azurerm_network_security_group.nsg.id
}

output "admin_password" {
  value     = random_password.admin_password.result
  sensitive = true
}
