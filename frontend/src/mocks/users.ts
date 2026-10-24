import type { Role } from "@/entities/role";
import type { DemoUser } from "@/entities/users";

/** Те же данные, что в database/migrations/003_demo_users.sql */
const ROLES: Role[] = [
  { code: 'accountant', full_name: 'Главный бухгалтер' },
  { code: 'ceo', full_name: 'Генеральный директор' },
  { code: 'cfo', full_name: 'Финансовый директор' },
  { code: 'decision_maker', full_name: 'Иной сотрудник, влияющий на принятие решений и имеющий доступ к интернет-банку' },
  { code: 'other_c_level', full_name: 'Другой C-level-руководитель' },
  { code: 'owner', full_name: 'Собственник бизнеса' },
  { code: 'treasurer', full_name: 'Руководитель казначейства' },
];

const DEMO_USERS: DemoUser[] = [
  { id: 1, synthetic_f: 'F_25503', first_name: 'Александр', last_name: 'Иванов' },
  { id: 2, synthetic_f: 'F_93095', first_name: 'Мария', last_name: 'Петрова' },
  { id: 3, synthetic_f: 'F_11036', first_name: 'Дмитрий', last_name: 'Сидоров' },
];

export { ROLES, DEMO_USERS };
