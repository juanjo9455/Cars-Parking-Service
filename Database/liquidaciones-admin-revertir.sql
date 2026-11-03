/* =====================================================================
   Cars Parking Service - DESHACER liquidaciones-admin.sql

   - Antes de correrlo, vuelve a publicar la versión del código sin la
     página Liquidaciones: esa página y el "Ver detalle" de Estado de
     turnos (DetalleLiquidacion) llaman a estos procedimientos.
   - Borra los 3 procedimientos. No toca datos.
   - Se puede correr más de una vez.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

DROP PROCEDURE IF EXISTS dbo.sp_consultarLiquidaciones;
DROP PROCEDURE IF EXISTS dbo.sp_vehiculosLiquidacion;
DROP PROCEDURE IF EXISTS dbo.sp_funcionariosLiquidaciones;
GO

PRINT 'Liquidaciones del administrador: procedimientos borrados.';
GO
