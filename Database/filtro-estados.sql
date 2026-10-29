/* =====================================================================
   Cars Parking Service - Filtro de varios estados en la tabla de ingresos

   - Correr ANTES de publicar el código de esta rama: la app nueva llama a
     sp_estadosFiltroIngresos y manda varios estados a sp_consultarRegistros.
   - La app actual sigue funcionando con este script ya corrido:
     sp_consultarRegistros sigue aceptando un solo estado.
   - No modifica ni borra datos. Solo crea un procedimiento y cambia otro.
   - Se puede correr más de una vez.
   - Para deshacerlo: filtro-estados-revertir.sql
   - ¡OJO! Ya se corrió zonas.sql: NO volver a correr este script. Dejaría
     sp_consultarRegistros sin @id_zona y la tabla de ingresos fallaría.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Estados del filtro de la tabla de ingresos, en el orden en que se ven.
      Para agregar un estado (por ejemplo cancelado) o cambiar cuáles van
      marcados al entrar, solo se modifica esta lista: por_defecto = 1 va
      marcado. "Todos" no va aquí: la página lo agrega siempre. */
IF OBJECT_ID('dbo.sp_estadosFiltroIngresos', 'P') IS NULL
    EXEC('CREATE PROCEDURE dbo.sp_estadosFiltroIngresos AS RETURN;');
GO

ALTER PROCEDURE dbo.sp_estadosFiltroIngresos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT valor, nombre, CAST(por_defecto AS BIT) AS por_defecto
    FROM (VALUES
        (1, 'esperando valet', 'Esperando valet', 1),
        (2, 'activo',          'Activo',          1),
        (3, 'parqueado',       'Parqueado',       1),
        (4, 'solicitado',      'Solicitado',      1),
        (5, 'despachado',      'Despachado',      1),
        (6, 'finalizado',      'Finalizado',      0)
    ) AS e (orden, valor, nombre, por_defecto)
    ORDER BY orden;
END;
GO

/* 2. sp_consultarRegistros: @estado_servicio recibe uno o varios estados
      separados por coma ('activo,parqueado'). NULL = todos. Lo demás queda
      igual que antes. */
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

PRINT 'Filtro de estados: procedimientos listos.';
GO
