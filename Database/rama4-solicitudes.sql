/* =====================================================================
   Cars Parking Service - Rama 4 sin zonas (solicitudes-y-reporte)
   Puntos 26 y 27 (quién y cuándo se solicitó el vehículo) y 21
   (reversar una solicitud). Las zonas (12, 23, 29) quedan para después.

   - Correr ANTES de usar el código de esta rama: si no, la app falla al
     buscar columnas que todavía no existen.
   - Solo agrega columnas que aceptan NULL en tbl_ingresos. No modifica ni
     borra datos existentes.
   - Se puede correr más de una vez: cada paso revisa si ya está hecho.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   - Para deshacerlo: rama4-solicitudes-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Quién solicitó el vehículo (punto 26): NULL = el cliente desde su enlace
    IF COL_LENGTH('dbo.tbl_ingresos', 'usuario_solicitud') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD usuario_solicitud INT NULL
            CONSTRAINT FK_tbl_ingresos_usuario_solicitud REFERENCES dbo.tbl_usuarios (id_usuario);

    -- 2. A qué hora se solicitó (punto 27)
    IF COL_LENGTH('dbo.tbl_ingresos', 'fecha_solicitud') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD fecha_solicitud DATETIME NULL;

    -- 3. Estado que tenía antes de solicitarse, para poder reversar (punto 21)
    IF COL_LENGTH('dbo.tbl_ingresos', 'estado_antes_solicitud') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD estado_antes_solicitud VARCHAR(20) NULL;

    COMMIT TRANSACTION;
    PRINT 'Rama 4 (solicitudes): cambios aplicados correctamente.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Rama 4 (solicitudes): hubo un error y no se aplicó ningún cambio.';
    THROW;
END CATCH;
GO

-- Verificación: deben salir las 3 columnas nuevas
SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS largo, IS_NULLABLE AS acepta_null
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tbl_ingresos'
  AND COLUMN_NAME IN ('usuario_solicitud', 'fecha_solicitud', 'estado_antes_solicitud')
ORDER BY COLUMN_NAME;
GO
