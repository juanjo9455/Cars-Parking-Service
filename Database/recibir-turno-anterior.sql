/* =====================================================================
   Cars Parking Service - Recibir vehículos solo de un turno que ya terminó

   Antes, un vehículo sin cobrar quedaba para recibir apenas el banco que lo
   tenía se quedaba sin sesión abierta (cerró sesión o se le cerró por
   inactividad), aunque su turno siguiera. Así, al banco que entraba a las
   9:40 le salía para heredar uno que otro banco del MISMO turno registró a
   las 8:00.

   Ahora, además de lo de antes, el turno del vehículo tiene que haber
   terminado. El turno del vehículo es tbl_ingresos.id_turno (el de quien lo
   registró, o el de quien lo recibió después), contado en la jornada en que
   entró o en la que lo recibieron por última vez (la jornada va de 6 am a
   6 am, como en la app). Los vehículos sin turno guardado siguen como antes.

   - Solo cambia fn_vehiculosPorRecibir (la usan sp_vehiculosPorRecibir y
     sp_recibirVehiculos, que no cambian). No modifica ni borra datos.
   - Va DESPUÉS de turnos-sin-margen.sql. Se puede correr más de una vez.
   - Para deshacerlo: recibir-turno-anterior-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* Igual que en turnos-sin-margen.sql, más el fin del turno del vehículo */
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
    LEFT JOIN dbo.tbl_turnos t
        ON t.id_turno = i.id_turno
    -- Desde cuándo lo tiene el banco actual: la última vez que lo recibieron o, si nunca, cuando entró
    OUTER APPLY (SELECT MAX(tr.fecha) AS fecha FROM dbo.tbl_traspasos tr WHERE tr.id_ingreso = i.id_ingreso) ult
    -- Fin del turno del vehículo en esa jornada (el turno de madrugada es el día siguiente)
    CROSS APPLY (SELECT DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00' AS TIME(0)), t.hora_fin),
                        CAST(DATEADD(DAY, CASE WHEN t.hora_inicio < '06:00' THEN 1 ELSE 0 END,
                                     CAST(DATEADD(HOUR, -6, COALESCE(ult.fecha, i.fecha_ingreso)) AS DATE)) AS DATETIME2)) AS fin) ft
    WHERE COALESCE(i.id_zona, us.id_zona) = @id_zona
      AND ISNULL(i.estado_pago, '') <> 'pagado'
      AND ISNULL(i.estado_servicio, '') <> 'finalizado'
      AND ISNULL(i.estado_servicio, '') <> 'cancelado'
      AND COALESCE(i.id_banco_responsable, i.id_banco) <> @id_usuario
      -- Solo de un turno que ya terminó (sin turno guardado: como antes)
      AND (t.id_turno IS NULL OR ft.fin <= @ahora)
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

PRINT 'Listo: solo se reciben vehículos de un turno que ya terminó.';
GO
