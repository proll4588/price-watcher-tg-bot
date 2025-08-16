-- Создаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Создаем функцию для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION update_updated_at_column() IS 'Автоматически обновляет поле updated_at при изменении записи';
