/* =====================================================================
   Cars Parking Service - DESHACER recibir-turno-anterior.sql

   fn_vehiculosPorRecibir vuelve a como quedó en turnos-sin-margen.sql: un
   vehículo queda para recibir apenas su banco no tiene sesión abierta, aunque
   el turno del vehículo no haya terminado. No toca datos. Se puede correr más
   de una vez.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

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
                 OR s.fin_turno > @ahora
                 OR (s.fin_corrido > @ahora AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))
      );
GO

PRINT 'Listo: fn_vehiculosPorRecibir volvió a como quedó en turnos-sin-margen.sql.';
GO
