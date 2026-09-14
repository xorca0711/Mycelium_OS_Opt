-- ─────────────────── WARDROBE PLUGIN (wiki) ───────────────────────────────

  CREATE TABLE IF NOT EXISTS wardrobe_wiki_entries (
    id            TEXT PRIMARY KEY,
    category      TEXT NOT NULL,
    title         TEXT NOT NULL,
    content_plain TEXT,
    content_json  TEXT,
    cover_image   TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS wardrobe_wiki_ts AFTER UPDATE ON wardrobe_wiki_entries
  BEGIN
    UPDATE wardrobe_wiki_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE INDEX IF NOT EXISTS idx_wardrobe_wiki_category ON wardrobe_wiki_entries(category);

  CREATE TABLE IF NOT EXISTS wardrobe_wiki_links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES wardrobe_wiki_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES wardrobe_wiki_entries(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_wardrobe_wiki_links_target ON wardrobe_wiki_links(target_id);

  CREATE TABLE IF NOT EXISTS wardrobe_wiki_gallery_images (
    id          TEXT PRIMARY KEY,
    entry_id    TEXT NOT NULL,
    image_path  TEXT NOT NULL,
    note        TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES wardrobe_wiki_entries(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_wardrobe_gallery_entry ON wardrobe_wiki_gallery_images(entry_id);

  -- ─────────────────── WARDROBE PLUGIN (archive / OOTD) ─────────────────────

  CREATE TABLE IF NOT EXISTS wardrobe_items (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    item_type      TEXT NOT NULL,
    brand          TEXT,
    purchase_date  TEXT,
    image_path     TEXT,
    sizing_json    TEXT,
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS wardrobe_items_ts AFTER UPDATE ON wardrobe_items
  BEGIN
    UPDATE wardrobe_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE INDEX IF NOT EXISTS idx_wardrobe_items_type   ON wardrobe_items(item_type);
  CREATE INDEX IF NOT EXISTS idx_wardrobe_items_status ON wardrobe_items(status);

  CREATE TABLE IF NOT EXISTS wardrobe_ootd_logs (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL UNIQUE,
    item_ids    TEXT NOT NULL DEFAULT '[]',
    note        TEXT,
    photo_path  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS wardrobe_ootd_ts AFTER UPDATE ON wardrobe_ootd_logs
  BEGIN
    UPDATE wardrobe_ootd_logs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE INDEX IF NOT EXISTS idx_wardrobe_ootd_date ON wardrobe_ootd_logs(date);

  -- ─────────────────── FILM NEG LAB (photo archive) ─────────────────────────

  CREATE TABLE IF NOT EXISTS filmneg_photos (
    id            TEXT PRIMARY KEY,
    title         TEXT,
    image_path    TEXT NOT NULL,
    notes         TEXT,
    taken_at      TEXT,
    camera        TEXT,
    film_stock    TEXT,
    lat           REAL,
    lng           REAL,
    location_name TEXT,
    is_favorite   BOOLEAN NOT NULL DEFAULT 0,
    rating        INTEGER,
    width         INTEGER,
    height        INTEGER,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS filmneg_photos_ts AFTER UPDATE ON filmneg_photos
  BEGIN
    UPDATE filmneg_photos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE INDEX IF NOT EXISTS idx_filmneg_photos_taken    ON filmneg_photos(taken_at);
  CREATE INDEX IF NOT EXISTS idx_filmneg_photos_favorite ON filmneg_photos(is_favorite);
  CREATE INDEX IF NOT EXISTS idx_filmneg_photos_geo      ON filmneg_photos(lat, lng);

  CREATE TABLE IF NOT EXISTS filmneg_tags (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    color       TEXT NOT NULL DEFAULT '#64c8ff',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS filmneg_photo_tags (
    photo_id  TEXT NOT NULL,
    tag_id    TEXT NOT NULL,
    PRIMARY KEY (photo_id, tag_id),
    FOREIGN KEY (photo_id) REFERENCES filmneg_photos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)   REFERENCES filmneg_tags(id)   ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_filmneg_pt_photo ON filmneg_photo_tags(photo_id);
  CREATE INDEX IF NOT EXISTS idx_filmneg_pt_tag   ON filmneg_photo_tags(tag_id);

  CREATE TABLE IF NOT EXISTS filmneg_trails (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT NOT NULL DEFAULT '#e8a94f',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS filmneg_trails_ts AFTER UPDATE ON filmneg_trails
  BEGIN
    UPDATE filmneg_trails SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

  CREATE TABLE IF NOT EXISTS filmneg_trail_photos (
    trail_id    TEXT NOT NULL,
    photo_id    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (trail_id, photo_id),
    FOREIGN KEY (trail_id) REFERENCES filmneg_trails(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES filmneg_photos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_filmneg_tp_trail ON filmneg_trail_photos(trail_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_filmneg_tp_photo ON filmneg_trail_photos(photo_id);

  CREATE TABLE IF NOT EXISTS filmneg_cameras (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'digital'
                    CHECK(type IN('digital','film')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_filmneg_cameras_type ON filmneg_cameras(type);
