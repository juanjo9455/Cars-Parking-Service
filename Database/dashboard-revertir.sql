/* =====================================================================
   Cars Parking Service - Deshace dashboard.sql

   Borra los SPs y funciones del Dashboard y los índices que creó ese
   script (solo los que tienen su nombre; si ya había otro, queda).
   No toca datos. La página Dashboard deja de funcionar: publica antes
   una versión sin ella.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

DROP PROCEDURE IF EXISTS dbo.sp_dashboardKpis;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardRecaudoPor;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardLiquidacionesPorFecha;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardHorasPico;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardValets;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardDistribucion;
DROP PROCEDURE IF EXISTS dbo.sp_dashboardDetalleLiquidaciones;
GO

-- fn_dashboardLiquidaciones usa fn_dashboardIngresos: se borra primero
DROP FUNCTION IF EXISTS dbo.fn_dashboardLiquidaciones;
DROP FUNCTION IF EXISTS dbo.fn_dashboardIngresos;
GO

DROP INDEX IF EXISTS IX_tbl_ingresos_fecha_ingreso ON dbo.tbl_ingresos;
DROP INDEX IF EXISTS IX_tbl_ingresos_id_turno ON dbo.tbl_ingresos;
DROP INDEX IF EXISTS IX_tbl_liquidacion_fecha ON dbo.tbl_liquidacion;
GO

PRINT 'Dashboard: deshecho.';
GO
