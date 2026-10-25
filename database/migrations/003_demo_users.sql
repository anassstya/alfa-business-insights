BEGIN;

CREATE TABLE IF NOT EXISTS demo_users (
    id BIGSERIAL PRIMARY KEY,
    synthetic_f TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    code TEXT PRIMARY KEY,
    full_name TEXT NOT NULL
);

INSERT INTO roles (code, full_name)
VALUES
    ('owner', 'Собственник бизнеса'),
    ('accountant', 'Главный бухгалтер'),
    ('ceo', 'Генеральный директор'),
    ('treasurer', 'Руководитель казначейства'),
    ('cfo', 'Финансовый директор'),
    ('other_c_level', 'Другой C-level-руководитель'),
    ('decision_maker', 'Иной сотрудник, влияющий на принятие решений и имеющий доступ к интернет-банку')
    ON CONFLICT (code) DO UPDATE SET
    full_name = EXCLUDED.full_name;

INSERT INTO demo_users (
    synthetic_f,
    first_name,
    last_name
)
VALUES
    ('F_25503', 'Александр', 'Иванов'),
    ('F_93095', 'Мария', 'Петрова'),
    ('F_11036', 'Дмитрий', 'Сидоров')
    ON CONFLICT (synthetic_f) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

COMMIT;
