CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY,
    demo_user_id BIGINT NOT NULL REFERENCES demo_users(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_user_created
    ON chat_messages(demo_user_id, created_at, id);
