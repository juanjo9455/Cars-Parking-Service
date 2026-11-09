/* =====================================================================
   Cars Parking Service - DESHACER turnos-sin-margen.sql

   - fn_vehiculosPorRecibir vuelve a como quedó en ajustes-admin.sql (con
     1 hora de margen al terminar el turno).
   - Borra sp_turnos, sp_crearTurno, sp_activarTurno y fn_turnosQueSeCruzan.
   - Los turnos que se crearon, activaron o desactivaron con esos SPs se
     quedan como están: son datos y los usan los ingresos y las sesiones.
   - Se puede correr más de una vez.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

DROP PROCEDURE IF EXISTS dbo.sp_activarTurno;
DROP PROCEDURE IF EXISTS dbo.sp_crearTurno;
DROP PROCEDURE IF EXISTS dbo.sp_turnos;
DROP FUNCTION IF EXISTS dbo.fn_turnosQueSeCruzan;
GO

-- fn_vehiculosPorRecibir como en ajustes-admin.sql
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
      AND ISNULL(i.estado_servicio, '') <> 'cancelado'
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

PRINT 'Turnos sin margen: deshecho.';
GO
