/* =====================================================================
   Cars Parking Service - Renumera las liquidaciones desde 1

   Las liquidaciones arrancaron en 1073 (la identidad de SQL Server
   salta de a 1000 al reiniciar). Este script las deja 1, 2, 3... en el
   mismo orden, sin perder ninguna. SQL Server no deja cambiar un id de
   identidad, así que cada liquidación se copia con su número nuevo, los
   vehículos (tbl_ingresos.id_liquidacion) pasan a ese número y se quita
   la copia vieja. Todo en una transacción: si algo falla, no cambia nada.

   Queda tbl_liquidacion_renumeracion (número anterior -> nuevo) para
   buscar una liquidación por el número viejo y para la reversa.
   Al final apaga IDENTITY_CACHE para que no vuelva a saltar.

   Correr cuando nadie esté liquidando. Una sola vez: si ya se corrió,
   no hace nada. Reversa: renumerar-liquidaciones-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;   -- cualquier error deshace todo
GO

-- Revisiones antes de empezar: si alguna falla, no se corre nada más
IF OBJECT_ID('dbo.tbl_liquidacion_renumeracion') IS NOT NULL
BEGIN
    RAISERROR('Ya se renumeró (existe tbl_liquidacion_renumeracion). No se hizo nada.', 16, 1);
    SET NOEXEC ON;
END
ELSE IF (SELECT STRING_AGG(name, ',') WITHIN GROUP (ORDER BY name) FROM sys.columns
         WHERE object_id = OBJECT_ID('dbo.tbl_liquidacion'))
        <> 'fecha,id_liquidacion,id_usuario,total_efectivo,total_liquidado,total_transferencias,total_vehiculos'
BEGIN
    RAISERROR('tbl_liquidacion tiene columnas distintas a las esperadas. No se hizo nada.', 16, 1);
    SET NOEXEC ON;
END
ELSE IF EXISTS (SELECT 1 FROM sys.foreign_key_columns fkc
                WHERE fkc.referenced_object_id = OBJECT_ID('dbo.tbl_liquidacion')
                  AND NOT (fkc.parent_object_id = OBJECT_ID('dbo.tbl_ingresos')
                           AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'id_liquidacion'))
BEGIN
    RAISERROR('Otra tabla, además de tbl_ingresos, guarda el id de la liquidación. No se hizo nada.', 16, 1);
    SET NOEXEC ON;
END
GO

BEGIN TRANSACTION;

DECLARE @liquidaciones INT, @total DECIMAL(18, 2), @vehiculos INT, @ultimo INT;

-- Nadie crea liquidaciones mientras tanto
SELECT @liquidaciones = COUNT(*), @total = SUM(total_liquidado)
FROM dbo.tbl_liquidacion WITH (TABLOCKX, HOLDLOCK);

SELECT @vehiculos = COUNT(*) FROM dbo.tbl_ingresos WHERE id_liquidacion IS NOT NULL;

-- Vehículos de cada liquidación antes del cambio, para comparar al final
SELECT id_liquidacion, COUNT(*) AS vehiculos
INTO #antes
FROM dbo.tbl_ingresos
WHERE id_liquidacion IS NOT NULL
GROUP BY id_liquidacion;

-- 1. Número anterior -> nuevo, en el mismo orden de hoy
CREATE TABLE dbo.tbl_liquidacion_renumeracion (
    id_anterior  INT       NOT NULL PRIMARY KEY,
    id_nuevo     INT       NOT NULL UNIQUE,
    fecha_cambio DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

INSERT INTO dbo.tbl_liquidacion_renumeracion (id_anterior, id_nuevo)
SELECT id_liquidacion, ROW_NUMBER() OVER (ORDER BY id_liquidacion)
FROM dbo.tbl_liquidacion;

-- Un número nuevo no puede estar ocupado por otra liquidación
IF EXISTS (SELECT 1 FROM dbo.tbl_liquidacion_renumeracion m
           JOIN dbo.tbl_liquidacion l ON l.id_liquidacion = m.id_nuevo
           WHERE m.id_anterior <> m.id_nuevo)
    THROW 50001, 'Un número nuevo ya lo tiene otra liquidación. No se hizo nada.', 1;

-- 2. Copia de cada liquidación con su número nuevo (las que ya tienen el suyo se quedan)
SET IDENTITY_INSERT dbo.tbl_liquidacion ON;

INSERT INTO dbo.tbl_liquidacion (id_liquidacion, fecha, id_usuario, total_vehiculos, total_efectivo, total_transferencias, total_liquidado)
SELECT m.id_nuevo, l.fecha, l.id_usuario, l.total_vehiculos, l.total_efectivo, l.total_transferencias, l.total_liquidado
FROM dbo.tbl_liquidacion l
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_anterior = l.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

SET IDENTITY_INSERT dbo.tbl_liquidacion OFF;

-- 3. Los vehículos pasan al número nuevo
UPDATE i
SET i.id_liquidacion = m.id_nuevo
FROM dbo.tbl_ingresos i
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_anterior = i.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

-- 4. Se quita la copia vieja (ya ningún vehículo apunta a ella)
DELETE l
FROM dbo.tbl_liquidacion l
JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_anterior = l.id_liquidacion
WHERE m.id_anterior <> m.id_nuevo;

-- Comprobaciones: mismas liquidaciones, mismo total y cada una con los mismos vehículos
IF (SELECT COUNT(*) FROM dbo.tbl_liquidacion) <> @liquidaciones
   OR ISNULL((SELECT SUM(total_liquidado) FROM dbo.tbl_liquidacion), 0) <> ISNULL(@total, 0)
   OR (SELECT COUNT(*) FROM dbo.tbl_ingresos WHERE id_liquidacion IS NOT NULL) <> @vehiculos
   OR EXISTS (SELECT 1 FROM #antes a
              JOIN dbo.tbl_liquidacion_renumeracion m ON m.id_anterior = a.id_liquidacion
              WHERE a.vehiculos <> (SELECT COUNT(*) FROM dbo.tbl_ingresos i WHERE i.id_liquidacion = m.id_nuevo))
    THROW 50002, 'Las cuentas no cuadran después de renumerar. No se hizo nada.', 1;

-- 5. La siguiente liquidación sigue después de la última
SET @ultimo = ISNULL((SELECT MAX(id_liquidacion) FROM dbo.tbl_liquidacion), 0);
DBCC CHECKIDENT ('dbo.tbl_liquidacion', RESEED, @ultimo) WITH NO_INFOMSGS;

COMMIT;

DROP TABLE #antes;

-- 6. Que la identidad no vuelva a saltar de a 1000 cuando se reinicia SQL Server (toda la base; las
--    inserciones quedan un poco más lentas, nada que se note con este volumen)
ALTER DATABASE SCOPED CONFIGURATION SET IDENTITY_CACHE = OFF;

PRINT CONCAT('Listo: ', @liquidaciones, ' liquidaciones, de 1 a ', @ultimo, '. La siguiente será la ', @ultimo + 1, '.');
SELECT id_anterior, id_nuevo FROM dbo.tbl_liquidacion_renumeracion ORDER BY id_nuevo;
GO

SET NOEXEC OFF;
GO
