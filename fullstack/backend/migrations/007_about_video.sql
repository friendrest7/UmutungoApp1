CREATE TABLE IF NOT EXISTS about_videos (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('video/mp4', 'video/webm')),
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    data BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
