/* Validación de zonas (SOLO LEE, no cambia nada)
   Compara las 7 zonas con lo que hay en la BD, sin importar mayúsculas, tildes ni espacios de sobra. */

DECLARE @esperado TABLE (zona VARCHAR(50), tipo VARCHAR(15), nombre VARCHAR(50));
INSERT @esperado VALUES
    ('Provenza', 'ubicacion', 'Hotel 23'), ('Provenza', 'ubicacion', 'Panka'), ('Provenza', 'ubicacion', 'Ruta Vaga'),
    ('Provenza', 'ubicacion', 'Capitulo'), ('Provenza', 'ubicacion', 'Misturia'), ('Provenza', 'ubicacion', 'Correo (Provenza)'),
    ('Provenza', 'ubicacion', 'Relatos'), ('Provenza', 'ubicacion', 'Canta Corazón'), ('Provenza', 'ubicacion', 'Dos Santos'),
    ('Provenza', 'ubicacion', 'Puente'), ('Provenza', 'ubicacion', 'Tangueria'), ('Provenza', 'ubicacion', 'Belisario'),
    ('Provenza', 'parqueadero', 'Vizcaya'),
    ('Palmas', 'ubicacion', 'Simah'), ('Palmas', 'parqueadero', 'Simah'),
    ('Correo Superior', 'ubicacion', 'Correo Superior'), ('Correo Superior', 'parqueadero', 'Correo Superior'),
    ('Marzano', 'ubicacion', 'Marzano'), ('Marzano', 'parqueadero', 'Marzano'),
    ('Envigado', 'ubicacion', 'Bolera'), ('Envigado', 'parqueadero', 'Bolera'),
    ('Okus', 'ubicacion', 'Okus'), ('Okus', 'parqueadero', 'Okus'),
    ('Ocio', 'ubicacion', 'Ocio'), ('Ocio', 'parqueadero', 'Ocio');

-- 1. Cada restaurante y parqueadero de las zonas: ¿existe en la BD y cómo está escrito?
SELECT e.zona, e.tipo, e.nombre AS esperado,
       COALESCE(CAST(u.id_ubicacion AS VARCHAR(10)), CAST(p.id_parqueadero AS VARCHAR(10)), 'NO EXISTE') AS id_en_bd,
       COALESCE(u.nombre_ubicacion, p.nombre_parqueadero) AS nombre_en_bd,
       COALESCE(u.estado, p.estado) AS estado
FROM @esperado e
LEFT JOIN dbo.tbl_ubicacion_servicios u
       ON e.tipo = 'ubicacion'
      AND LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI
LEFT JOIN dbo.tbl_parqueaderos p
       ON e.tipo = 'parqueadero'
      AND LTRIM(RTRIM(p.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI
ORDER BY e.zona, e.tipo, e.nombre;

-- 2. Lo que hay en la BD y no quedó en ninguna zona (¿sobra, está escrito distinto o falta en la lista?)
SELECT 'ubicacion' AS tipo, u.id_ubicacion AS id, u.nombre_ubicacion AS nombre, u.estado
FROM dbo.tbl_ubicacion_servicios u
WHERE NOT EXISTS (SELECT 1 FROM @esperado e WHERE e.tipo = 'ubicacion'
                  AND LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI)
UNION ALL
SELECT 'parqueadero', p.id_parqueadero, p.nombre_parqueadero, p.estado
FROM dbo.tbl_parqueaderos p
WHERE NOT EXISTS (SELECT 1 FROM @esperado e WHERE e.tipo = 'parqueadero'
                  AND LTRIM(RTRIM(p.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = e.nombre COLLATE Latin1_General_CI_AI)
ORDER BY tipo, nombre;

-- 3. ¿Ya hay algo de zonas? (todo debería salir NULL) y versión de SQL Server
SELECT OBJECT_ID('dbo.tbl_zonas') AS tbl_zonas,
       COL_LENGTH('dbo.tbl_ingresos', 'id_zona') AS ingresos_id_zona,
       COL_LENGTH('dbo.tbl_ubicacion_servicios', 'id_zona') AS ubicaciones_id_zona,
       COL_LENGTH('dbo.tbl_parqueaderos', 'id_zona') AS parqueaderos_id_zona,
       COL_LENGTH('dbo.tbl_sesiones', 'id_zona') AS sesiones_id_zona,
       CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(20)) AS version_sql,
       (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()) AS compatibilidad;

-- 4. Columnas de las tablas que se van a tocar (para que el script use los mismos tipos)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS largo, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('tbl_ubicacion_servicios', 'tbl_parqueaderos', 'tbl_sesiones')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
