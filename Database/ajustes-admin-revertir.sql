/* =====================================================================
   Cars Parking Service - DESHACER ajustes-admin.sql

   ¡CUIDADO! Borra el historial de cambios (tbl_ingresos_cambios) CON SUS
   DATOS. Antes de borrarlo, los vehículos cancelados vuelven al estado que
   tenían (sale del mismo historial). Úsalo solo si hay que volver atrás, y
   antes vuelve a la versión del código sin estos ajustes.
   sp_estadosFiltroIngresos, fn_vehiculosPorRecibir y sp_pasarACorrido
   vuelven a como estaban en filtro-estados.sql y turnos.sql.

   - Se puede correr más de una vez: cada paso revisa si existe.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Los cancelados vuelven al estado que tenían antes de cancelarlos (el último registro de cancelación)
IF OBJECT_ID('dbo.tbl_ingresos_cambios', 'U') IS NOT NULL
BEGIN
    UPDATE i
    SET estado_servicio = c.antes
    FROM dbo.tbl_ingresos i
    CROSS APPLY (
        SELECT TOP 1 antes
        FROM dbo.tbl_ingresos_cambios
        WHERE id_ingreso = i.id_ingreso
          AND campo = 'cancelacion'
        ORDER BY fecha DESC, id_cambio DESC
    ) c
    WHERE i.estado_servicio = 'cancelado'
      AND c.antes IS NOT NULL;

    PRINT CONCAT('Ajustes admin: ', @@ROWCOUNT, ' vehículos cancelados volvieron a su estado anterior.');
END;
GO

DROP PROCEDURE IF EXISTS dbo.sp_cambiarComprobante;
DROP PROCEDURE IF EXISTS dbo.sp_cambiarLugarEntrega;
DROP PROCEDURE IF EXISTS dbo.sp_cambiarLugarIngreso;
DROP PROCEDURE IF EXISTS dbo.sp_cancelarServicio;
DROP PROCEDURE IF EXISTS dbo.sp_cambiosIngresos;
DROP PROCEDURE IF EXISTS dbo.sp_registrarCambioIngreso;
DROP TABLE IF EXISTS dbo.tbl_ingresos_cambios;
GO

-- 2. sp_estadosFiltroIngresos como en filtro-estados.sql (sin "Cancelado")
CREATE OR ALTER PROCEDURE dbo.sp_estadosFiltroIngresos
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

-- 3. fn_vehiculosPorRecibir como en turnos.sql
CREATE OR ALTER FUNCTION dbo.fn_vehiculosPorRecibir (@id_usuario INT, @id_zona INT, @ahora DATETIME2)
RETURNS TABLE
AS
RETURN
    SELECT
        i.id_ingreso,
        i.placa,
        i.estado_servicio,
        us.nombre_ubicacion,
        COALESCE(i.id_banco_responsable, i.id_banco) AS id_banco_actual,
        i.id_turno
    FROM dbo.tbl_ingresos i
    INNER JOIN dbo.tbl_ubicacion_servicios us
        ON us.id_ubicacion = i.id_ubicacion
    WHERE COALESCE(i.id_zona, us.id_zona) = @id_zona
      AND ISNULL(i.estado_pago, '') <> 'pagado'
      AND ISNULL(i.estado_servicio, '') <> 'finalizado'
      AND COALESCE(i.id_banco_responsable, i.id_banco) <> @id_usuario
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.fn_sesionesAbiertas() s
          WHERE s.id_usuario = COALESCE(i.id_banco_responsable, i.id_banco)
            AND (s.id_rol <> 2
                 OR s.id_turno IS NULL
                 OR DATEADD(HOUR, 1, s.fin_turno) > @ahora
                 OR (s.fin_corrido > @ahora AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))
      );
GO

-- 4. sp_pasarACorrido como en turnos.sql
CREATE OR ALTER PROCEDURE dbo.sp_pasarACorrido
    @id_usuario INT,
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @id_sesion INT, @id_corrido INT;

    SELECT TOP 1 @id_sesion = id_sesion, @id_corrido = id_corrido
    FROM dbo.fn_sesionesAbiertas()
    WHERE id_usuario = @id_usuario
      AND id_rol = 2
      AND DATEADD(HOUR, 1, fin_turno) <= @ahora
      AND fin_corrido > @ahora
    ORDER BY id_sesion DESC;

    IF @id_corrido IS NULL
        RETURN;

    BEGIN TRANSACTION;

    UPDATE dbo.tbl_sesiones
    SET id_turno = @id_corrido
    WHERE id_sesion = @id_sesion;

    UPDATE dbo.tbl_ingresos
    SET id_turno = @id_corrido
    WHERE COALESCE(id_banco_responsable, id_banco) = @id_usuario
      AND ISNULL(estado_pago, '') <> 'pagado'
      AND ISNULL(estado_servicio, '') <> 'finalizado';

    COMMIT TRANSACTION;
END;
GO

PRINT 'Ajustes admin: deshecho.';
GO
