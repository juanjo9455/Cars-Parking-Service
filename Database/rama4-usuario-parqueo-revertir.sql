/* =====================================================================
   Cars Parking Service - DESHACER rama4-usuario-parqueo.sql

   ¡CUIDADO! Borra las 2 columnas CON SUS DATOS (quién y a qué hora se
   marcó cada vehículo como parqueado). Úsalo solo si hay que volver
   atrás, y antes vuelve a la versión del código sin este cambio.

   - Se puede correr más de una vez: cada paso revisa si existe.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- Primero la llave foránea, después las columnas
    IF OBJECT_ID('dbo.FK_tbl_ingresos_usuario_parqueo', 'F') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP CONSTRAINT FK_tbl_ingresos_usuario_parqueo;

    IF COL_LENGTH('dbo.tbl_ingresos', 'fecha_parqueo') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN fecha_parqueo;
    IF COL_LENGTH('dbo.tbl_ingresos', 'usuario_parqueo') IS NOT NULL
        ALTER TABLE dbo.tbl_ingresos DROP COLUMN usuario_parqueo;

    COMMIT TRANSACTION;
    PRINT 'Rama 4 (usuario que parqueó): cambios revertidos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Rama 4 (usuario que parqueó): hubo un error y no se revirtió nada.';
    THROW;
END CATCH;
GO
