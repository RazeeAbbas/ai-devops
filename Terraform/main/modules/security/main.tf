resource "azurerm_network_security_group" "nsg" {
  name                = var.name_prefix
  location            = var.location
  resource_group_name = var.resource_group
  tags                = var.tags

  security_rule {
    name                       = "allow-rdp"
    priority                   = 300
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3389"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "random_password" "admin_password" {
  length           = 20
  special          = true
  override_special = "!@#$%&*"
}
