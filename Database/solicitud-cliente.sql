/* =====================================================================
   Cars Parking Service - Quién solicitó el vehículo: el cliente o un operador
   Columna solicitud_cliente en tbl_ingresos:
       1    = lo pidió el cliente desde su enlace (la app)
       0    = lo pidió un operador desde la tabla (valet, banco o admin)
       NULL = no se ha pedido (o se reversó la solicitud)

   - Correr ANTES de publicar la versión de la app que usa la columna: si
     no, la app falla al buscar una columna que todavía no existe.
   - Solo agrega una columna que acepta NULL y llena las solicitudes que
     ya existen con lo que ya estaba guardado: usuario_solicitud vacío y
     fecha_solicitud con valor = el cliente; usuario_solicitud con valor =
     un operador. No modifica ni borra nada más.
   - Se puede correr más de una vez: cada paso revisa si ya está hecho.
   - Todo o nada: si algo falla, no queda ningún cambio a medias.
   - Para deshacerlo: solicitud-cliente-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. La columna
    IF COL_LENGTH('dbo.tbl_ingresos', 'solicitud_cliente') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD solicitud_cliente BIT NULL;

    -- 2. Las solicitudes que ya existen (con EXEC: la columna no existe cuando se compila este bloque)
    EXEC('UPDATE dbo.tbl_ingresos
          SET solicitud_cliente = CASE WHEN usuario_solicitud IS NULL THEN 1 ELSE 0 END
          WHERE fecha_solicitud IS NOT NULL
            AND solicitud_cliente IS NULL;');

    COMMIT TRANSACTION;
    PRINT 'Solicitud del cliente: cambios aplicados correctamente.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Solicitud del cliente: hubo un error y no se aplicó ningún cambio.';
    THROW;
END CATCH;
GO

-- Verificación: la columna nueva y cuántas solicitudes quedaron de cada tipo
SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo, IS_NULLABLE AS acepta_null
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tbl_ingresos' AND COLUMN_NAME = 'solicitud_cliente';

SELECT CASE solicitud_cliente WHEN 1 THEN 'cliente' WHEN 0 THEN 'operador' ELSE 'sin solicitud' END AS solicito,
       COUNT(*) AS vehiculos
FROM dbo.tbl_ingresos
GROUP BY solicitud_cliente;
GO
