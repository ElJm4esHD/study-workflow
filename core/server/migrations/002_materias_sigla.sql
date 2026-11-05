ALTER TABLE materias ADD COLUMN sigla TEXT NOT NULL DEFAULT '';
-- colores viejos -> pastel del mismo nombre (mismo índice de PALETTE)
UPDATE materias SET color = CASE color
  WHEN '#e5484d' THEN '#f4a3a3'
  WHEN '#e8590c' THEN '#f5bf93'
  WHEN '#b88700' THEN '#f0d27a'
  WHEN '#6fa016' THEN '#c5de8a'
  WHEN '#30a46c' THEN '#93dcbf'
  WHEN '#12a594' THEN '#8edbd3'
  WHEN '#0f95c9' THEN '#8fd3f0'
  WHEN '#3e63dd' THEN '#9fc3f7'
  WHEN '#8e4ec6' THEN '#c7b6f5'
  WHEN '#d6409f' THEN '#f2a7ba'
  WHEN '#ab6e4a' THEN '#dbb89e'
  WHEN '#8b8d98' THEN '#b6bcc8'
  ELSE color END
WHERE color IN ('#e5484d', '#e8590c', '#b88700', '#6fa016', '#30a46c', '#12a594', '#0f95c9', '#3e63dd', '#8e4ec6', '#d6409f', '#ab6e4a', '#8b8d98');
