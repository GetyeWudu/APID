export interface OrganizationLocation {
  id: string;
  name: string;
}

export interface OrganizationLocated {
  organizationPath?: OrganizationLocation[];
}
