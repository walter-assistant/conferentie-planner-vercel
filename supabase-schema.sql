-- Conferentie Planner Database Schema
-- Voor gebruik met Supabase

-- Conferenties tabel
CREATE TABLE conferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Versie geschiedenis tabel (voor herstel van oude versies)
CREATE TABLE conference_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conference_id uuid REFERENCES conferences(id) ON DELETE CASCADE,
  name text,
  data jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Row Level Security inschakelen
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_versions ENABLE ROW LEVEL SECURITY;

-- Policies: alle ingelogde gebruikers kunnen alles lezen en schrijven
CREATE POLICY "Allow all for authenticated" ON conferences 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON conference_versions 
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Indexes voor betere performance
CREATE INDEX idx_conferences_created_by ON conferences(created_by);
CREATE INDEX idx_conferences_updated_at ON conferences(updated_at);
CREATE INDEX idx_conference_versions_conference_id ON conference_versions(conference_id);
CREATE INDEX idx_conference_versions_created_at ON conference_versions(created_at);

-- Trigger voor updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conferences_updated_at 
  BEFORE UPDATE ON conferences 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();