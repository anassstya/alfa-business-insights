/**
 * Код роли из GET /api/v1/roles (`roles[].code`).
 * FIXME(openapi): в спецификации это просто string без enum — набор ролей задаёт БД
 * (owner, accountant, ceo, treasurer, cfo, other_c_level, decision_maker), поэтому фронт
 * не может проверить код на этапе типизации.
 */
type RoleId = string;

/** Элемент `roles[]` в ответе GET /api/v1/roles */
interface Role {
  code: RoleId;
  full_name: string;
}

/** Ответ GET /api/v1/roles */
interface RolesResponse {
  roles: Role[];
}

export type { RoleId, Role, RolesResponse };
