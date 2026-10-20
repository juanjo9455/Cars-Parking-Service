/* =====================================================================
   Cars Parking Service - DESHACER rama4-solicitudes.sql

   ¡CUIDADO! Borra las 3 columnas CON SUS DATOS (quién y cuándo se
   solicitó cada vehículo y el estado anterior para reversar). Úsalo solo
   si hay que volver atrás, y antes vuelve a la versión del código sin
   esta rama.

   - Se puede correr más de una vez: cada paso revisa si existe.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Primero la llave foránea, después las columnas
    IF OBJECT_ID('dbo.FK_tbl_ingresos_usuario_solicitud', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP CONSTRAINT FK_tbl_ingresos_usuario_solicitud;

    IF COL_LENGTH('dbo.tbl_ingresos', 'estado_antes_solicitud') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN estado_antes_solicitud;
    IF COL_LENGTH('dbo.tbl_ingresos', 'fecha_solicitud') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN fecha_solicitud;
    IF COL_LENGTH('dbo.tbl_ingresos', 'usuario_solicitud') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN usuario_solicitud;

    COMMIT TRANSACTION;
    PRINT 'Rama 4 (solicitudes): cambios revertidos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Rama 4 (solicitudes): hubo un error y no se revirtió nada.';
    THROW;
END CATCH;
GO
