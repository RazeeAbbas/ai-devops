resource "azurerm_resource_group" "customer_rg" {
  name     = var.name
  location = var.location
  tags     = var.tag
}