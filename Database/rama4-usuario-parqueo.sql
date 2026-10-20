/* =====================================================================
   Cars Parking Service - Rama 4 (solicitudes-y-reporte)
   Quién marcó el vehículo como parqueado y a qué hora: el Key desde su
   vista o un operador desde Información en la tabla de ingresos.

   - Correr ANTES de usar el código de esta versión: si no, la app falla
     al buscar columnas que todavía no existen.
   - Necesita rama4-solicitudes.sql ya aplicado (es la misma rama).
   - Solo agrega columnas que aceptan NULL en tbl_ingresos. No modifica ni
     borra datos existentes: los ingresos anteriores quedan sin registro.
   - Se puede correr más de una vez: cada paso revisa si ya está hecho.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   - Para deshacerlo: rama4-usuario-parqueo-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Quién tocó Parquear
    IF COL_LENGTH('dbo.tbl_ingresos', 'usuario_parqueo') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD usuario_parqueo INT NULL
            CONSTRAINT FK_tbl_ingresos_usuario_parqueo REFERENCES dbo.tbl_usuarios (id_usuario);

    -- 2. A qué hora
    IF COL_LENGTH('dbo.tbl_ingresos', 'fecha_parqueo') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD fecha_parqueo DATETIME NULL;

    COMMIT TRANSACTION;
    PRINT 'Rama 4 (usuario que parqueó): cambios aplicados correctamente.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Rama 4 (usuario que parqueó): hubo un error y no se aplicó ningún cambio.';
    THROW;
END CATCH;
GO

-- Verificación: deben salir las 2 columnas nuevas
SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo, IS_NULLABLE AS acepta_null
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tbl_ingresos'
  AND COLUMN_NAME IN ('usuario_parqueo', 'fecha_parqueo')
ORDER BY COLUMN_NAME;
GO
