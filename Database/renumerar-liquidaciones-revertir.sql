/* =====================================================================
   Cars Parking Service - Deshace renumerar-liquidaciones.sql

   Devuelve a cada liquidación su número anterior (1073, 1074...) con
   tbl_liquidacion_renumeracion, y los vehículos con ella. Las que se
   crearon después de renumerar se quedan con su número. Vuelve a
   prender IDENTITY_CACHE y borra tbl_liquidacion_renumeracion.
   Todo en una transacción: si algo falla, no cambia nada.
   Correr cuando nadie esté liquidando.
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.tbl_liquidacion_renumeracion') IS NULL
BEGIN
    RAISERROR('No hay nada que deshacer (no existe tbl_liquidacion_renumeracion).', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

DECLARE @liquidaciones INT, @vehiculos INT, @ultimo INT;

SELECT @liquidaciones = COUNT(*) FROM dbo.tbl_liquidacion WITH (TABLOCKX, HOLDLOCK);
SELECT @vehiculos = COUNT(*) FROM dbo.tbl_ingresos WHERE id_liquidacion IS NOT NULL;

-- El número anterior no puede estar ocupado por otra liquidación
IF EXISTS (SELECT 1 FROM dbo.tbl_liquidacion_renumeracion m
           JOIN dbo.tbl_liquidacion l ON l.id_liquidacion = m.id_anterior
           WHERE m.id_anterior <> m.id_nuevo)
    THROW 50001, 'Un número anterior ya lo tiene otra liquidación. No se hizo nada.', 1;

SET IDENTITY_INSERT dbo.tbl_liquidacion ON;

INSERT INTO dbo.tbl_liquidacion (id_liquidacion, fecha, id_usuario, total_vehiculos, total_efectivo, total_transferencias, total_liquidado)
SELECT m.id_anterior, l.fecha, l.id_usuario, l.total_vehiculos, l.total_efectivo, l.total_transferencias, l.total_liquidado
FROM dbo.tbl_liquidacion l
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_nuevo = l.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

SET IDENTITY_INSERT dbo.tbl_liquidacion OFF;

UPDATE i
SET i.id_liquidacion = m.id_anterior
FROM dbo.tbl_ingresos i
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_nuevo = i.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

DELETE l
FROM dbo.tbl_liquidacion l
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_nuevo = l.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

IF (SELECT COUNT(*) FROM dbo.tbl_liquidacion) <> @liquidaciones
   OR (SELECT COUNT(*) FROM dbo.tbl_ingresos WHERE id_liquidacion IS NOT NULL) <> @vehiculos
    THROW 50002, 'Las cuentas no cuadran. No se hizo nada.', 1;

SET @ultimo = ISNULL((SELECT MAX(id_liquidacion) FROM dbo.tbl_liquidacion), 0);
DBCC CHECKIDENT ('dbo.tbl_liquidacion', RESEED, @ultimo) WITH NO_INFOMSGS;

DROP TABLE dbo.tbl_liquidacion_renumeracion;

COMMIT;

ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = ON;

PRINT CONCAT('Listo: las liquidaciones volvieron a su número anterior. La siguiente será la ', @ultimo + 1, '.');
GO

SET NOEXEC OFF;
GO
