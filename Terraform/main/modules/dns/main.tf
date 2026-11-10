resource "azurerm_dns_zone" "zone" {
  name                = var.dns_zone_name
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_dns_a_record" "vm_dns" {
  name                = var.dns_name
  zone_name           = azurerm_dns_zone.zone.name
  resource_group_name = var.resource_group_name
  ttl                 = 300
  records             = [var.public_ip]
}
