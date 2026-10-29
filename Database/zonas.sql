/* =====================================================================
   Cars Parking Service - Zonas (fase 1: base de datos)

   - 7 zonas. Cada ubicación de servicio y cada parqueadero queda en una.
   - id_zona en tbl_ubicacion_servicios, tbl_parqueaderos, tbl_ingresos
     y tbl_sesiones (la zona en la que entra cada operador).
   - SPs nuevos: sp_zonas, sp_ubicacionesServicio y sp_parqueaderos.
   - sp_consultarRegistros recibe @id_zona (opcional, al final).

   - Se puede correr ANTES de publicar el código de zonas: todo lo nuevo
     acepta NULL y los parámetros nuevos son opcionales, así que la app
     actual sigue funcionando igual.
   - No borra datos. Llena id_zona donde está vacío, quita "RESTAURANTE"
     del nombre de 6 ubicaciones, llama BOLERA a la ubicación y al
     parqueadero de Envigado y crea PUENTE y BELISARIO (valor 0).
   - Se puede correr más de una vez: cada paso revisa si ya está hecho, y
     no cambia una zona que alguien ya haya puesto.
   - Para deshacerlo: zonas-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------------------
   1. Estructura
   --------------------------------------------------------------------- */
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.tbl_zonas', 'U') IS NULL
        CREATE TABLE dbo.tbl_zonas (
            id_zona INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tbl_zonas PRIMARY KEY,
            nombre_zona VARCHAR(50) NOT NULL CONSTRAINT UQ_tbl_zonas_nombre UNIQUE,
            estado VARCHAR(20) NOT NULL CONSTRAINT DF_tbl_zonas_estado DEFAULT 'activo'
        );

    IF COL_LENGTH('dbo.tbl_ubicacion_servicios', 'id_zona') IS NULL
        ALTER TABLE dbo.tbl_ubicacion_servicios ADD id_zona INT NULL
            CONSTRAINT FK_tbl_ubicacion_servicios_zona REFERENCES dbo.tbl_zonas (id_zona);

    IF COL_LENGTH('dbo.tbl_parqueaderos', 'id_zona') IS NULL
        ALTER TABLE dbo.tbl_parqueaderos ADD id_zona INT NULL
            CONSTRAINT FK_tbl_parqueaderos_zona REFERENCES dbo.tbl_zonas (id_zona);

    -- Zona del ingreso, guardada al crearlo: si una ubicación cambia de zona, lo viejo no se mueve
    IF COL_LENGTH('dbo.tbl_ingresos', 'id_zona') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD id_zona INT NULL
            CONSTRAINT FK_tbl_ingresos_zona REFERENCES dbo.tbl_zonas (id_zona);

    -- Zona en la que entró el operador en ese turno
    IF COL_LENGTH('dbo.tbl_sesiones', 'id_zona') IS NULL
        ALTER TABLE dbo.tbl_sesiones ADD id_zona INT NULL
            CONSTRAINT FK_tbl_sesiones_zona REFERENCES dbo.tbl_zonas (id_zona);

    COMMIT TRANSACTION;
    PRINT 'Zonas: estructura lista.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

-- El filtro por zona de la tabla de ingresos
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tbl_ingresos_id_zona' AND object_id = OBJECT_ID('dbo.tbl_ingresos'))
    CREATE INDEX IX_tbl_ingresos_id_zona ON dbo.tbl_ingresos (id_zona);
GO

/* ---------------------------------------------------------------------
   2. Las 7 zonas y en cuál queda cada ubicación y parqueadero.
      Los nombres van como están en la BD (sin importar mayúsculas,
      tildes ni espacios de sobra). Para cambiar una asignación, se
      corrige esta lista.
   --------------------------------------------------------------------- */
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO dbo.tbl_zonas (nombre_zona)
    SELECT v.nombre
    FROM (VALUES ('Provenza'), ('Palmas'), ('Correo Superior'), ('Marzano'),
                 ('Envigado'), ('Okus'), ('Ocio')) AS v (nombre)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_zonas z WHERE z.nombre_zona = v.nombre);

    -- Nombres: sin "RESTAURANTE" al principio (lo demás, como CANTINA, se deja) y la bolera como BOLERA.
    -- Si ya existe uno con el nombre nuevo, no se cambia (no quedan dos iguales)
    DECLARE @renombrar TABLE (tipo VARCHAR(15), actual VARCHAR(100), nuevo VARCHAR(100));
    INSERT INTO @renombrar (tipo, actual, nuevo) VALUES
        ('ubicacion', 'RESTAURANTE PANKA', 'PANKA'),
        ('ubicacion', 'RESTAURANTE MISTURA', 'MISTURA'),
        ('ubicacion', 'RESTAURANTE EL CORREO', 'EL CORREO'),
        ('ubicacion', 'RESTAURANTE RELATOS', 'RELATOS'),
        ('ubicacion', 'RESTAURANTE LA PAMPA', 'LA PAMPA'),
        ('ubicacion', 'RESTAURANTE OCIO', 'OCIO'),
        ('ubicacion', 'SUPER BOULLING - ENVIGADO', 'BOLERA'),
        ('parqueadero', 'SUPER BOULLING', 'BOLERA');

    UPDATE u SET nombre_ubicacion = r.nuevo
    FROM dbo.tbl_ubicacion_servicios u
    JOIN @renombrar r ON r.tipo = 'ubicacion'
     AND LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = r.actual COLLATE Latin1_General_CI_AI
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_ubicacion_servicios o
                      WHERE LTRIM(RTRIM(o.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = r.nuevo COLLATE Latin1_General_CI_AI);

    UPDATE p SET nombre_parqueadero = r.nuevo
    FROM dbo.tbl_parqueaderos p
    JOIN @renombrar r ON r.tipo = 'parqueadero'
     AND LTRIM(RTRIM(p.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = r.actual COLLATE Latin1_General_CI_AI
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_parqueaderos o
                      WHERE LTRIM(RTRIM(o.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = r.nuevo COLLATE Latin1_General_CI_AI);

    -- Ubicaciones nuevas de Provenza. Valor en 0: se cambia desde Configuraciones (admin)
    INSERT INTO dbo.tbl_ubicacion_servicios (nombre_ubicacion, valor_servicio, estado)
    SELECT v.nombre, 0, 'activo'
    FROM (VALUES ('PUENTE'), ('BELISARIO')) AS v (nombre)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_ubicacion_servicios u
                      WHERE LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = v.nombre COLLATE Latin1_General_CI_AI);

    DECLARE @asignar TABLE (zona VARCHAR(50), tipo VARCHAR(15), nombre VARCHAR(100));
    INSERT INTO @asignar (zona, tipo, nombre) VALUES
        -- Zona 1: Provenza
        ('Provenza', 'ubicacion', 'HOTEL 23'),
        ('Provenza', 'ubicacion', 'PANKA'),
        ('Provenza', 'ubicacion', 'RUTA VAGA'),
        ('Provenza', 'ubicacion', 'CAPITULO'),
        ('Provenza', 'ubicacion', 'MISTURA'),
        ('Provenza', 'ubicacion', 'EL CORREO'),
        ('Provenza', 'ubicacion', 'RELATOS'),
        ('Provenza', 'ubicacion', 'CANTA CORAZON'),
        ('Provenza', 'ubicacion', 'CANTINA DOS SANTOS'),
        ('Provenza', 'ubicacion', 'PUENTE'),
        ('Provenza', 'ubicacion', 'LA TANGUERIA'),
        ('Provenza', 'ubicacion', 'BELISARIO'),
        ('Provenza', 'ubicacion', 'LA PAMPA'),
        ('Provenza', 'parqueadero', 'PARQUEADERO VIZCAYA'),
        -- Zona 2: Palmas
        ('Palmas', 'ubicacion', 'SIMAH- LAS PALMAS'),
        ('Palmas', 'parqueadero', 'SIMAH'),
        -- Zona 3: Correo Superior
        ('Correo Superior', 'ubicacion', 'CORREO SUPERIOR - SAN LUCAS'),
        ('Correo Superior', 'parqueadero', 'CORREO SUPERIOR'),
        -- Zona 4: Marzano
        ('Marzano', 'ubicacion', 'MARZANO - EL CAMPESTRE'),
        ('Marzano', 'parqueadero', 'MARZANO'),
        -- Zona 5: Envigado
        ('Envigado', 'ubicacion', 'BOLERA'),
        ('Envigado', 'parqueadero', 'BOLERA'),
        -- Zona 6: Okus
        ('Okus', 'ubicacion', 'OKUS'),
        ('Okus', 'parqueadero', 'OKUS'),
        -- Zona 7: Ocio
        ('Ocio', 'ubicacion', 'OCIO'),
        ('Ocio', 'parqueadero', 'OCIO');
        -- Sin zona por ahora: el parqueadero PISCINA

    -- Solo donde está vacío: no se cambia una zona que alguien ya haya puesto
    UPDATE u SET id_zona = z.id_zona
    FROM dbo.tbl_ubicacion_servicios u
    JOIN @asignar a ON a.tipo = 'ubicacion'
     AND LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = a.nombre COLLATE Latin1_General_CI_AI
    JOIN dbo.tbl_zonas z ON z.nombre_zona = a.zona
    WHERE u.id_zona IS NULL;

    UPDATE p SET id_zona = z.id_zona
    FROM dbo.tbl_parqueaderos p
    JOIN @asignar a ON a.tipo = 'parqueadero'
     AND LTRIM(RTRIM(p.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = a.nombre COLLATE Latin1_General_CI_AI
    JOIN dbo.tbl_zonas z ON z.nombre_zona = a.zona
    WHERE p.id_zona IS NULL;

    -- Ingresos que ya existen: la zona de su ubicación
    UPDATE i SET id_zona = u.id_zona
    FROM dbo.tbl_ingresos i
    JOIN dbo.tbl_ubicacion_servicios u ON u.id_ubicacion = i.id_ubicacion
    WHERE i.id_zona IS NULL AND u.id_zona IS NOT NULL;

    COMMIT TRANSACTION;

    -- Aviso: lo de la lista que no se encontró en la BD (hay que crearlo o corregir el nombre)
    SELECT a.zona, a.tipo, a.nombre AS no_encontrado
    FROM @asignar a
    WHERE (a.tipo = 'ubicacion' AND NOT EXISTS (SELECT 1 FROM dbo.tbl_ubicacion_servicios u
              WHERE LTRIM(RTRIM(u.nombre_ubicacion)) COLLATE Latin1_General_CI_AI = a.nombre COLLATE Latin1_General_CI_AI))
       OR (a.tipo = 'parqueadero' AND NOT EXISTS (SELECT 1 FROM dbo.tbl_parqueaderos p
              WHERE LTRIM(RTRIM(p.nombre_parqueadero)) COLLATE Latin1_General_CI_AI = a.nombre COLLATE Latin1_General_CI_AI));

    PRINT 'Zonas: datos cargados.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

/* ---------------------------------------------------------------------
   3. SPs para las listas (login, ingreso, filtros, vista Key).
      Lo que todavía no tiene zona sale en todas: así no se pierde de
      vista mientras se le asigna.
   --------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE dbo.sp_zonas
    @solo_activas BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT id_zona, nombre_zona, estado
    FROM dbo.tbl_zonas
    WHERE @solo_activas = 0 OR estado = 'activo'
    ORDER BY nombre_zona;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ubicacionesServicio
    @id_zona INT = NULL,
    @solo_activas BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.*
    FROM dbo.tbl_ubicacion_servicios u
    WHERE (@id_zona IS NULL OR u.id_zona = @id_zona OR u.id_zona IS NULL)
      AND (@solo_activas = 0 OR u.estado = 'activo')
    ORDER BY u.nombre_ubicacion;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_parqueaderos
    @id_zona INT = NULL,
    @solo_activos BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT p.*
    FROM dbo.tbl_parqueaderos p
    WHERE (@id_zona IS NULL OR p.id_zona = @id_zona OR p.id_zona IS NULL)
      AND (@solo_activos = 0 OR p.estado = 'activo')
    ORDER BY p.nombre_parqueadero;
END;
GO

/* ---------------------------------------------------------------------
   4. sp_consultarRegistros: @id_zona al final y opcional. Lo demás queda
      igual que en filtro-estados.sql.
   --------------------------------------------------------------------- */
ALTER PROCEDURE [dbo].[sp_consultarRegistros]
    @placa VARCHAR(20) = NULL,
    @lugar VARCHAR(50) = NULL,
    @estado_servicio VARCHAR(500) = NULL,
    @estado_pago VARCHAR(20) = NULL,
    @id_usuario INT = NULL,
    @parqueadero VARCHAR(50) = NULL,
    @fecha_inicio DATE = NULL,
    @fecha_fin DATE = NULL,
    @id_ubicacion int = NULL,
    @id_zona INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @placa = CASE
                    WHEN @placa IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@placa)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@placa))
                 END;

    SET @lugar = CASE
                    WHEN @lugar IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@lugar)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@lugar))
                 END;

    -- Sin espacios alrededor de las comas, para que 'activo, parqueado' también sirva.
    -- Vacío queda '' (no ' '): así sigue trayendo los ingresos sin estado, como antes
    SET @estado_servicio = CASE
                    WHEN @estado_servicio IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@estado_servicio)) = '' THEN ''
                    ELSE REPLACE(REPLACE(LTRIM(RTRIM(@estado_servicio)), ' ,', ','), ', ', ',')
                 END;

    SET @estado_pago = CASE
                    WHEN @estado_pago IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@estado_pago)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@estado_pago))
                 END;

    SET @parqueadero = CASE
                    WHEN @parqueadero IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@parqueadero)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@parqueadero))
                 END;

    SELECT
        i.*,
        u.nombre_ubicacion,
        p.nombre_parqueadero

    FROM dbo.tbl_ingresos i

    INNER JOIN dbo.tbl_ubicacion_servicios u
        ON i.id_ubicacion = u.id_ubicacion

    INNER JOIN dbo.tbl_parqueaderos p
        ON i.id_parqueadero = p.id_parqueadero

    WHERE
        (@placa IS NULL OR i.placa = @placa)

        AND (@lugar IS NULL OR u.nombre_ubicacion = @lugar)

        -- El estado del ingreso tiene que estar en la lista. CHARINDEX y no LIKE: no hay comodines
        AND (@estado_servicio IS NULL
             OR CHARINDEX(',' + LTRIM(RTRIM(i.estado_servicio)) + ',', ',' + @estado_servicio + ',') > 0)

        AND (@estado_pago IS NULL OR i.estado_pago = @estado_pago)

        AND (
            @id_usuario IS NULL
            OR i.id_valet = @id_usuario
            OR i.id_banco = @id_usuario
        )

        AND (@parqueadero IS NULL OR p.nombre_parqueadero = @parqueadero)

        AND (
            (@fecha_inicio IS NULL OR CAST(i.fecha_ingreso AS DATE) >= @fecha_inicio)
            AND (@fecha_fin IS NULL OR CAST(i.fecha_ingreso AS DATE) < DATEADD(DAY, 1, @fecha_fin))
        )

        AND (@id_ubicacion IS NULL OR i.id_ubicacion = @id_ubicacion)

        -- Zona del ingreso; los que aún no la tienen guardada toman la de su ubicación
        AND (@id_zona IS NULL OR COALESCE(i.id_zona, u.id_zona) = @id_zona);

END;
GO

PRINT 'Zonas: procedimientos listos.';
GO
