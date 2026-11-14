/* =====================================================================
   Cars Parking Service - Heredar apenas termina el turno, cierre o no
   sesión el banco

   Antes, un vehículo con turno salía para recibir solo si su turno ya había
   terminado Y su banco no tenía la sesión abierta. Liquidar no cierra la
   sesión: el banco que liquidaba y no le daba "Salir" se quedaba con sus
   carros y el banco nuevo no los veía.

   Ahora, si el vehículo tiene turno, sale apenas termina ese turno, cierre o
   no sesión su banco. Solo se lo queda el banco de Turno 1 que sigue
   trabajando en Corrido (usó la app en los últimos 10 minutos y el Corrido no
   ha terminado). Los vehículos sin turno guardado siguen como antes.

   - Solo cambia fn_vehiculosPorRecibir (la usan sp_vehiculosPorRecibir y
     sp_recibirVehiculos, que no cambian). No modifica ni borra datos.
   - Va DESPUÉS de recibir-turno-anterior.sql. Se puede correr más de una vez.
   - Para deshacerlo: correr otra vez recibir-turno-anterior.sql
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
      AND (
          -- Con turno: sale apenas termina, cierre o no sesión su banco. Solo se lo queda el que sigue en Corrido
          (t.id_turno IS NOT NULL
           AND ft.fin <= @ahora
           AND NOT EXISTS (
               SELECT 1
               FROM dbo.fn_sesionesAbiertas() s
               WHERE s.id_usuario = COALESCE(i.id_banco_responsable, i.id_banco)
                 AND s.fin_corrido > @ahora
                 AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))
          OR
          -- Sin turno guardado: como antes (su banco no tiene la sesión abierta en turno)
          (t.id_turno IS NULL
           AND NOT EXISTS (
               SELECT 1
               FROM dbo.fn_sesionesAbiertas() s
               WHERE s.id_usuario = COALESCE(i.id_banco_responsable, i.id_banco)
                 AND (s.id_rol <> 2
                      OR s.id_turno IS NULL
                      OR s.fin_turno > @ahora
                      OR (s.fin_corrido > @ahora AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))))
      );
GO

PRINT 'Listo: los vehículos se heredan apenas termina su turno, cierre o no sesión el banco.';
GO
