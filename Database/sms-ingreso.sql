/* =====================================================================
   Cars Parking Service - SMS de ingreso (Onurix)

   Al registrar un ingreso, además del WhatsApp de siempre, se manda un SMS
   con la placa y el enlace para solicitar el vehículo (Services/SmsService.cs).
   Cada intento queda registrado aquí para auditarlo: número, mensaje, si se
   envió, la respuesta de Onurix (id, estado, créditos) o el error. La clave
   de Onurix nunca se guarda.

   - Crea tbl_sms_enviados y sp_registrarSms. No modifica ni borra datos.
   - Se puede correr más de una vez.
   - Para deshacerlo:
       DROP PROCEDURE dbo.sp_registrarSms;
       DROP TABLE dbo.tbl_sms_enviados;
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Un registro por cada SMS que se intentó mandar */
IF OBJECT_ID('dbo.tbl_sms_enviados', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_sms_enviados (
        id_sms        INT IDENTITY(1, 1) CONSTRAINT PK_tbl_sms_enviados PRIMARY KEY,
        id_ingreso    INT NULL CONSTRAINT FK_tbl_sms_enviados_ingreso
                          REFERENCES dbo.tbl_ingresos (id_ingreso) ON DELETE SET NULL,
        placa         NVARCHAR(20) NULL,
        telefono      VARCHAR(20) NULL,      -- como se mandó a Onurix: con indicativo y sin +
        mensaje       NVARCHAR(500) NULL,
        exito         BIT NOT NULL,
        id_proveedor  NVARCHAR(100) NULL,    -- id del envío que devuelve Onurix
        estado        NVARCHAR(50) NULL,     -- data.state de Onurix
        creditos      INT NULL,              -- data.credits de Onurix
        codigo_error  INT NULL,              -- campo error de Onurix (1077, 1010...)
        detalle       NVARCHAR(500) NULL,    -- msg de Onurix o el motivo si no se pudo mandar
        fecha         DATETIME2(0) NOT NULL
    );

    CREATE INDEX IX_tbl_sms_enviados_ingreso ON dbo.tbl_sms_enviados (id_ingreso);
    CREATE INDEX IX_tbl_sms_enviados_fecha ON dbo.tbl_sms_enviados (fecha);

    PRINT 'SMS: tbl_sms_enviados creada.';
END;
GO

/* 2. Guarda un intento de envío. Lo llama SmsService después de cada SMS (enviado o no) */
CREATE OR ALTER PROCEDURE dbo.sp_registrarSms
    @id_ingreso INT,
    @placa NVARCHAR(20),
    @telefono VARCHAR(20),
    @mensaje NVARCHAR(500),
    @exito BIT,
    @id_proveedor NVARCHAR(100),
    @estado NVARCHAR(50),
    @creditos INT,
    @codigo_error INT,
    @detalle NVARCHAR(500),
    @fecha DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.tbl_sms_enviados
        (id_ingreso, placa, telefono, mensaje, exito, id_proveedor, estado, creditos, codigo_error, detalle, fecha)
    VALUES
        (@id_ingreso, @placa, @telefono, @mensaje, @exito, @id_proveedor, @estado, @creditos, @codigo_error, @detalle, @fecha);
END;
GO

PRINT 'Listo: SMS de ingreso (tbl_sms_enviados y sp_registrarSms).';
GO
