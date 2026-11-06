/* =====================================================================
   Cars Parking Service - DESHACER turnos.sql

   ¡CUIDADO! Borra los turnos, el registro de traspasos y las columnas
   id_turno (ingresos y sesiones) e id_banco_responsable CON SUS DATOS: los
   vehículos recibidos vuelven a verse con el banco que los registró.
   Úsalo solo si hay que volver atrás, y antes vuelve a la versión del
   código sin turnos. sp_consultarRegistros vuelve a filtrar por id_banco.

   - Se puede correr más de una vez: cada paso revisa si existe.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

DROP PROCEDURE IF EXISTS dbo.sp_recibirVehiculos;
DROP PROCEDURE IF EXISTS dbo.sp_vehiculosPorRecibir;
DROP PROCEDURE IF EXISTS dbo.sp_pasarACorrido;
DROP FUNCTION IF EXISTS dbo.fn_vehiculosPorRecibir;
DROP FUNCTION IF EXISTS dbo.fn_sesionesAbiertas;
GO

-- sp_consultarRegistros como en zonas.sql (filtra por id_banco)
CREATE OR ALTER PROCEDURE [dbo].[sp_consultarRegistros]
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
        AND (@id_zona IS NULL OR COALESCE(i.id_zona, u.id_zona) = @id_zona);
END;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    DROP TABLE IF EXISTS dbo.tbl_traspasos;

    IF OBJECT_ID('dbo.FK_tbl_sesiones_id_turno', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_sesiones DROP CONSTRAINT FK_tbl_sesiones_id_turno;
    IF COL_LENGTH('dbo.tbl_sesiones', 'id_turno') IS NOT NULL
        ALTER TABLE dbo.tbl_sesiones DROP COLUMN id_turno;

    IF OBJECT_ID('dbo.FK_tbl_ingresos_id_banco_responsable', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP CONSTRAINT FK_tbl_ingresos_id_banco_responsable;
    IF COL_LENGTH('dbo.tbl_ingresos', 'id_banco_responsable') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN id_banco_responsable;

    IF OBJECT_ID('dbo.FK_tbl_ingresos_id_turno', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP CONSTRAINT FK_tbl_ingresos_id_turno;
    IF COL_LENGTH('dbo.tbl_ingresos', 'id_turno') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN id_turno;

    DROP TABLE IF EXISTS dbo.tbl_turnos;

    COMMIT TRANSACTION;
    PRINT 'Turnos: cambios revertidos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Turnos: hubo un error y no se revirtió nada.';
    THROW;
END CATCH;
GO
