/* =====================================================================
   Cars Parking Service - DESHACER filtro-estados.sql

   - Antes de correrlo, vuelve a publicar la versión del código sin esta
     rama: la app nueva llama a sp_estadosFiltroIngresos y manda varios
     estados juntos, que el procedimiento original no entiende.
   - Deja sp_consultarRegistros exactamente como estaba y borra
     sp_estadosFiltroIngresos. No toca datos.
   - Se puede correr más de una vez.
   - ¡OJO! Con zonas.sql ya corrido, primero va zonas-revertir.sql: este
     script deja sp_consultarRegistros sin @id_zona.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.sp_estadosFiltroIngresos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_estadosFiltroIngresos;
GO

ALTER PROCEDURE [dbo].[sp_consultarRegistros]
    @placa VARCHAR(20) = NULL,
    @lugar VARCHAR(50) = NULL,
    @estado_servicio VARCHAR(20) = NULL,
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

    SET @estado_servicio = CASE
                    WHEN @estado_servicio IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@estado_servicio)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@estado_servicio))
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

        AND (@estado_servicio IS NULL OR i.estado_servicio = @estado_servicio)

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

PRINT 'Filtro de estados: procedimientos como antes.';
GO
