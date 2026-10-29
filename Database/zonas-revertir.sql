/* =====================================================================
   Cars Parking Service - DESHACER zonas.sql

   ¡CUIDADO! Borra las zonas y la zona de cada ubicación, parqueadero,
   ingreso y turno. Antes de correrlo, vuelve a publicar la versión del
   código sin zonas: esa versión usa las columnas y los SPs que esto borra.

   - Deja sp_consultarRegistros como en filtro-estados.sql.
   - Los nombres corregidos (sin "RESTAURANTE", BOLERA) y las ubicaciones
     PUENTE y BELISARIO se quedan: son corrección de datos, no zonas.
   - Se puede correr más de una vez.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

DROP PROCEDURE IF EXISTS dbo.sp_zonas;
DROP PROCEDURE IF EXISTS dbo.sp_ubicacionesServicio;
DROP PROCEDURE IF EXISTS dbo.sp_parqueaderos;
GO

ALTER PROCEDURE [dbo].[sp_consultarRegistros]
    @placa VARCHAR(20) = NULL,
    @lugar VARCHAR(50) = NULL,
    @estado_servicio VARCHAR(500) = NULL,
    @estado_pago VARCHAR(20) = NULL,
    @id_usuario INT = NULL,
    @parqueadero VARCHAR(50) = NULL,
    @fecha_inicio DATE = NULL,
    @fecha_fin DATE = NULL,
    @id_ubicacion int = NULL
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

        AND (@id_ubicacion IS NULL OR i.id_ubicacion = @id_ubicacion);

END;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tbl_ingresos_id_zona' AND object_id = OBJECT_ID('dbo.tbl_ingresos'))
        DROP INDEX IX_tbl_ingresos_id_zona ON dbo.tbl_ingresos;

    IF OBJECT_ID('dbo.FK_tbl_ingresos_zona', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP CONSTRAINT FK_tbl_ingresos_zona;
    IF COL_LENGTH('dbo.tbl_ingresos', 'id_zona') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN id_zona;

    IF OBJECT_ID('dbo.FK_tbl_sesiones_zona', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_sesiones DROP CONSTRAINT FK_tbl_sesiones_zona;
    IF COL_LENGTH('dbo.tbl_sesiones', 'id_zona') IS NOT NULL
        ALTER TABLE dbo.tbl_sesiones DROP COLUMN id_zona;

    IF OBJECT_ID('dbo.FK_tbl_parqueaderos_zona', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_parqueaderos DROP CONSTRAINT FK_tbl_parqueaderos_zona;
    IF COL_LENGTH('dbo.tbl_parqueaderos', 'id_zona') IS NOT NULL
        ALTER TABLE dbo.tbl_parqueaderos DROP COLUMN id_zona;

    IF OBJECT_ID('dbo.FK_tbl_ubicacion_servicios_zona', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ubicacion_servicios DROP CONSTRAINT FK_tbl_ubicacion_servicios_zona;
    IF COL_LENGTH('dbo.tbl_ubicacion_servicios', 'id_zona') IS NOT NULL
        ALTER TABLE dbo.tbl_ubicacion_servicios DROP COLUMN id_zona;

    IF OBJECT_ID('dbo.tbl_zonas', 'U') IS NOT NULL
        DROP TABLE dbo.tbl_zonas;

    COMMIT TRANSACTION;
    PRINT 'Zonas: todo como antes.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
