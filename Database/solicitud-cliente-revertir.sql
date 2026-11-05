/* =====================================================================
   Cars Parking Service - DESHACER solicitud-cliente.sql

   ¡CUIDADO! Borra la columna solicitud_cliente CON SUS DATOS (si cada
   vehículo lo pidió el cliente o un operador). Úsalo solo si hay que
   volver atrás, y antes vuelve a la versión del código sin esta columna.
   Lo demás de la solicitud (usuario_solicitud, fecha_solicitud) no se toca.

   - Se puede correr más de una vez: revisa si la columna existe.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.tbl_ingresos', 'solicitud_cliente') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN solicitud_cliente;

    COMMIT TRANSACTION;
    PRINT 'Solicitud del cliente: cambios revertidos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Solicitud del cliente: hubo un error y no se revirtió nada.';
    THROW;
END CATCH;
GO
