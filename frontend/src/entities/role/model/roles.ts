/**
 * Роли пользователя внутри организации.
 * В API пока нет справочника ролей — список зашит на фронте,
 * значение уходит в запрос новостей параметром `role`.
 */
const ROLES = [
  { value: 'owner', label: 'Собственник' },
  { value: 'ceo', label: 'Генеральный директор' },
  { value: 'cfo', label: 'Финансовый директор' },
  { value: 'accountant', label: 'Бухгалтер' },
  { value: 'lawyer', label: 'Юрист' },
] as const;

type RoleId = typeof ROLES[number]['value'];

const DEFAULT_ROLE: RoleId = 'owner';

const isRoleId = (value: unknown): value is RoleId => ROLES.some(role => role.value === value);

const getRoleLabel = (role: RoleId | null) => ROLES.find(r => r.value === role)?.label ?? role;

export { ROLES, DEFAULT_ROLE, isRoleId, getRoleLabel, type RoleId };
