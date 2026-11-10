module "resource_group" {
  source = "./modules/resource_group"

  name     = var.resource_group_name
  location = var.location
  tag      = local.common_tags
}

module "security" {
  source = "./modules/security"

  name_prefix    = local.normalized_vm_name
  location       = var.location
  resource_group = module.resource_group.name
  tags           = local.common_tags
}

module "networking" {
  source = "./modules/networking"

  resource_group = module.resource_group.name
  location       = var.location
  name_prefix    = local.normalized_vm_name
  tags           = local.common_tags
  nsg_id         = module.security.nsg_id
}

module "compute" {
  source = "./modules/compute"

  vm_size        = var.vm_size
  admin_username = var.admin_username
  admin_password = module.security.admin_password
  nic_id         = module.networking.nic_id
  tags           = local.common_tags
  vm_name        = var.vm_name
  location       = var.location
  resource_group = module.resource_group.name
}

module "dns" {
  source = "./modules/dns"

  dns_name            = local.hostname
  dns_zone_name       = local.dns_zone_name
  resource_group_name = module.resource_group.name
  public_ip           = module.networking.public_ip
  tags                = local.common_tags
}