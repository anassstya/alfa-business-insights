type RoleId = string;

interface Role {
  code: RoleId;
  full_name: string;
}

interface RolesResponse {
  roles: Role[];
}

export type { RoleId, Role, RolesResponse };
