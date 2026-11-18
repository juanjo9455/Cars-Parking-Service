/* =====================================================================
   Cars Parking Service - El admin corrige la placa o el celular de un ingreso

   Lápiz del admin en Información (tabla de vehículos), como los lugares y
   los operadores. Guarda el cambio y lo deja en el historial
   (tbl_ingresos_cambios, campo 'placa' o 'telefono').

   - Crea sp_cambiarDatoCliente. No modifica ni borra datos.
   - Va DESPUÉS de ajustes-admin.sql (usa tbl_ingresos_cambios).
   - Se puede correr más de una vez.
   - Para deshacerlo: DROP PROCEDURE dbo.sp_cambiarDatoCliente;
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* Cambia la placa o el celular de un vehículo que no está liquidado ni cancelado. La app ya validó el formato y
   que la placa no tenga otro servicio activo. Devuelve 1 si cambió */
CREATE OR ALTER PROCEDURE dbo.sp_cambiarDatoCliente
    @id_ingreso INT,
    @id_usuario INT,
    @campo VARCHAR(30),
    @valor NVARCHAR(150),
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @cambio TABLE (antes NVARCHAR(150));

    BEGIN TRANSACTION;

    UPDATE i
    SET placa    = CASE WHEN @campo = 'placa'    THEN @valor ELSE i.placa END,
        telefono = CASE WHEN @campo = 'telefono' THEN @valor ELSE i.telefono END
    OUTPUT CASE WHEN @campo = 'placa' THEN deleted.placa ELSE deleted.telefono END INTO @cambio (antes)
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.id_ingreso = @id_ingreso
      AND @campo IN ('placa', 'telefono')
      AND NULLIF(LTRIM(RTRIM(@valor)), '') IS NOT NULL
      AND ISNULL(CASE WHEN @campo = 'placa' THEN i.placa ELSE i.telefono END, '') <> @valor
      AND i.id_liquidacion IS NULL
      AND ISNULL(i.estado_liquidacion, 0) = 0
      AND ISNULL(LTRIM(RTRIM(i.estado_servicio)), '') <> 'cancelado';

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues)
    SELECT @id_ingreso, @id_usuario, @ahora, @campo, antes, @valor
    FROM @cambio;

    COMMIT TRANSACTION;

    SELECT CAST(COUNT(*) AS BIT) AS Value FROM @cambio;
END;
GO

PRINT 'Listo: el admin puede corregir la placa y el celular de un ingreso.';
GO
