-- Custom triggers and functions that drizzle-kit cannot express directly.
-- Apply via `psql $DATABASE_URL -f src/server/db/triggers.sql` after `yarn db:push`.

-- search_vector trigger: weights title most, channel name second, description
-- third. We use the 'simple' configuration so multi-language libraries do not
-- get surprised by English stemming.
CREATE OR REPLACE FUNCTION videos_search_refresh()
RETURNS trigger AS $$
DECLARE
    chan_name text;
BEGIN
    SELECT name INTO chan_name FROM channels WHERE id = NEW.channel_id;
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')),       'A') ||
        setweight(to_tsvector('simple', coalesce(chan_name, '')),       'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS videos_search_trg ON videos;
CREATE TRIGGER videos_search_trg
    BEFORE INSERT OR UPDATE OF title, description, channel_id
    ON videos
    FOR EACH ROW
    EXECUTE FUNCTION videos_search_refresh();

-- Backfill the search_vector when a channel rename lands.
CREATE OR REPLACE FUNCTION channels_name_propagate()
RETURNS trigger AS $$
BEGIN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
        UPDATE videos SET title = title WHERE channel_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS channels_name_trg ON channels;
CREATE TRIGGER channels_name_trg
    AFTER UPDATE OF name ON channels
    FOR EACH ROW
    EXECUTE FUNCTION channels_name_propagate();
