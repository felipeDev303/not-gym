-- ============================================================
-- NotGym — Schema completo
-- Ejecutar en el SQL Editor de Supabase (en orden)
-- ============================================================


-- ------------------------------------------------------------
-- 0. Extensión geoespacial
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;


-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------

CREATE TABLE spot_categories (
  id   SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  category_id INT REFERENCES spot_categories(id),
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  address     TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE spot_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id     UUID REFERENCES spots(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  geojson     JSONB NOT NULL,
  distance_km FLOAT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2. Índice espacial
-- ------------------------------------------------------------
CREATE INDEX spots_location_idx ON spots USING GIST (location);


-- ------------------------------------------------------------
-- 3. Función RPC — spots cercanos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION spots_near(lat FLOAT, lng FLOAT, radius INT)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  description   TEXT,
  category_slug TEXT,
  category_icon TEXT,
  latitude      FLOAT,
  longitude     FLOAT,
  address       TEXT,
  verified      BOOLEAN
) AS $$
  SELECT
    s.id,
    s.name,
    s.description,
    c.slug,
    c.icon,
    ST_Y(s.location::geometry) AS latitude,
    ST_X(s.location::geometry) AS longitude,
    s.address,
    s.verified
  FROM spots s
  JOIN spot_categories c ON c.id = s.category_id
  WHERE ST_DWithin(
    s.location,
    ST_Point(lng, lat)::geography,
    radius
  )
  AND s.verified = TRUE;
$$ LANGUAGE sql STABLE;


-- ------------------------------------------------------------
-- 4. Datos iniciales — categorías
-- ------------------------------------------------------------
INSERT INTO spot_categories (slug, name, icon) VALUES
  ('calistenia',      'Zona de Calistenia',    '🏋️'),
  ('pista_atletica',  'Pista Atlética',         '🏃'),
  ('ruta_running',    'Ruta de Running',        '🗺️'),
  ('parque_fitness',  'Parque Fitness',         '🌳'),
  ('cancha',          'Cancha Polideportiva',   '🏟️'),
  ('escalada',        'Zona de Escalada',       '🧗'),
  ('skateboarding',   'Skateboarding',          '🛹'),
  ('bicicleta',       'Ciclismo',               '🚴'),
  ('tenis',           'Tenis',                  '🎾'),
  ('futbol',          'Fútbol',                 '⚽'),
  ('baloncesto',      'Baloncesto',             '🏀'),
  ('ajedrez',         'Ajedrez',                '♟️'),
  ('patines',         'Patinaje',               '🛼'),
  ('parkour',         'Parkour',                '🤸');


-- ------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ------------------------------------------------------------

-- spots
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spots_public_read"
  ON spots FOR SELECT
  USING (verified = TRUE);

CREATE POLICY "spots_auth_insert"
  ON spots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "spots_owner_update"
  ON spots FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "spots_owner_delete"
  ON spots FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- spot_photos
ALTER TABLE spot_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_public_read"
  ON spot_photos FOR SELECT
  USING (TRUE);

CREATE POLICY "photos_auth_insert"
  ON spot_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "photos_owner_delete"
  ON spot_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- routes
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routes_public_read"
  ON routes FOR SELECT
  USING (TRUE);

CREATE POLICY "routes_auth_insert"
  ON routes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "routes_owner_delete"
  ON routes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);


-- spot_tags (junction: spots ↔ spot_categories, many-to-many)
CREATE TABLE spot_tags (
  spot_id     UUID REFERENCES spots(id) ON DELETE CASCADE,
  category_id INT  REFERENCES spot_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (spot_id, category_id)
);
ALTER TABLE spot_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_public_read" ON spot_tags FOR SELECT USING (TRUE);

-- spot_favorites
CREATE TABLE spot_favorites (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id    UUID REFERENCES spots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, spot_id)
);
ALTER TABLE spot_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON spot_favorites
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 6. Storage bucket (hacer manualmente en el dashboard)
-- ============================================================
-- Dashboard → Storage → New bucket
--   Name:   spot-photos
--   Public: ON
-- ============================================================
