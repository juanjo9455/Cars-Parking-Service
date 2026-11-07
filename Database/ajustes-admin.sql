/* =====================================================================
   Cars Parking Service - Ajustes del administrador (noviembre 2026)

   - Historial de cambios de cada vehículo (tbl_ingresos_cambios): quién
     cambió qué, cuándo, antes y después. Lo llenan las correcciones del
     admin (cobro, operadores, lugares y foto del comprobante) y la
     cancelación del servicio.
   - Cancelar servicio (solo el admin, con motivo): el vehículo queda
     "cancelado". No se puede si ya se cobró o se liquidó. El cancelado no
     se ofrece a otros bancos, no pasa a Corrido y sale como "Cancelado"
     (sin marcar) en el filtro de estados de la tabla de ingresos.
   - El admin cambia el lugar de ingreso, el lugar de entrega y la foto del
     comprobante, cada uno con su registro en el historial.

   - Correr ANTES de publicar la versión que usa estos cambios.
   - No modifica ni borra datos. Crea tbl_ingresos_cambios y los SPs
     sp_registrarCambioIngreso, sp_cambiosIngresos, sp_cancelarServicio,
     sp_cambiarLugarIngreso, sp_cambiarLugarEntrega y sp_cambiarComprobante.
     Actualiza sp_estadosFiltroIngresos, fn_vehiculosPorRecibir y
     sp_pasarACorrido (solo para dejar por fuera los cancelados).
   - ¡OJO! Después de correr este script NO vuelvas a correr turnos.sql ni
     filtro-estados.sql: devolverían esos tres a su versión anterior.
   - Se puede correr más de una vez: cada paso revisa si ya está hecho.
   - Para deshacerlo: ajustes-admin-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Historial de cambios de cada vehículo. campo: metodo_pago, valor_total, valet, despacho, parqueo, banco,
      lugar_ingreso, lugar_entrega, comprobante o cancelacion */
IF OBJECT_ID('dbo.tbl_ingresos_cambios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_ingresos_cambios (
        id_cambio  INT IDENTITY(1, 1) CONSTRAINT PK_tbl_ingresos_cambios PRIMARY KEY,
        id_ingreso INT NOT NULL CONSTRAINT FK_tbl_ingresos_cambios_ingreso REFERENCES dbo.tbl_ingresos (id_ingreso) ON DELETE CASCADE,
        id_usuario INT NOT NULL CONSTRAINT FK_tbl_ingresos_cambios_usuario REFERENCES dbo.tbl_usuarios (id_usuario),
        fecha      DATETIME NOT NULL,
        campo      VARCHAR(30) NOT NULL,
        antes      NVARCHAR(150) NULL,
        despues    NVARCHAR(150) NULL,
        motivo     NVARCHAR(250) NULL
    );

    CREATE INDEX IX_tbl_ingresos_cambios_ingreso ON dbo.tbl_ingresos_cambios (id_ingreso, fecha);

    PRINT 'Ajustes admin: tbl_ingresos_cambios creada.';
END;
GO

/* 2. Registra un cambio. Lo usa la app después de las correcciones que ya hacía (cobro y operadores), dentro de
      la misma transacción */
CREATE OR ALTER PROCEDURE dbo.sp_registrarCambioIngreso
    @id_ingreso INT,
    @id_usuario INT,
    @campo VARCHAR(30),
    @antes NVARCHAR(150) = NULL,
    @despues NVARCHAR(150) = NULL,
    @motivo NVARCHAR(250) = NULL,
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues, motivo)
    VALUES (@id_ingreso, @id_usuario, @ahora, @campo, @antes, @despues, @motivo);
END;
GO

/* 3. Cambios de uno o varios vehículos (@ids: '12,15,20'), el más reciente primero, con el nombre de quien lo hizo */
CREATE OR ALTER PROCEDURE dbo.sp_cambiosIngresos
    @ids VARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.id_ingreso,
        c.fecha,
        c.campo,
        c.antes,
        c.despues,
        c.motivo,
        LTRIM(RTRIM(CONCAT(u.nombres, ' ', u.apellidos))) AS usuario
    FROM dbo.tbl_ingresos_cambios c
    LEFT JOIN dbo.tbl_usuarios u
        ON u.id_usuario = c.id_usuario
    WHERE CHARINDEX(',' + CAST(c.id_ingreso AS VARCHAR(12)) + ',', ',' + REPLACE(@ids, ' ', '') + ',') > 0
    ORDER BY c.id_ingreso, c.fecha DESC, c.id_cambio DESC;
END;
GO

/* 4. El admin cancela el servicio: solo si no está cobrado ni liquidado, ni finalizado o ya cancelado. Queda el
      motivo en el historial. Devuelve 1 si se canceló */
CREATE OR ALTER PROCEDURE dbo.sp_cancelarServicio
    @id_ingreso INT,
    @id_usuario INT,
    @motivo NVARCHAR(250),
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @antes TABLE (estado VARCHAR(50));

    BEGIN TRANSACTION;

    UPDATE i
    SET estado_servicio = 'cancelado',
        fecha_fin_servicio = NULL
    OUTPUT deleted.estado_servicio INTO @antes (estado)
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.id_ingreso = @id_ingreso
      AND ISNULL(i.estado_pago, '') <> 'pagado'
      AND i.id_liquidacion IS NULL
      AND ISNULL(i.estado_liquidacion, 0) = 0
      AND ISNULL(LTRIM(RTRIM(i.estado_servicio)), '') NOT IN ('finalizado', 'cancelado');

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues, motivo)
    SELECT @id_ingreso, @id_usuario, @ahora, 'cancelacion', estado, N'cancelado', @motivo
    FROM @antes;

    COMMIT TRANSACTION;

    SELECT CAST(COUNT(*) AS BIT) AS Value FROM @antes;
END;
GO

/* 5. El admin cambia el lugar de ingreso (la app ya revisó que sea de la misma zona): solo si no está liquidado ni
      cancelado. Si todavía no se ha solicitado, el lugar de entrega (que al registrar es el de ingreso) cambia con
      él. Devuelve 1 si cambió */
CREATE OR ALTER PROCEDURE dbo.sp_cambiarLugarIngreso
    @id_ingreso INT,
    @id_usuario INT,
    @id_ubicacion INT,
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @cambio TABLE (de_ubicacion INT);
    DECLARE @nuevo VARCHAR(100) = (SELECT nombre_ubicacion FROM dbo.tbl_ubicacion_servicios WHERE id_ubicacion = @id_ubicacion);

    BEGIN TRANSACTION;

    UPDATE i
    SET id_ubicacion = @id_ubicacion,
        lugar_entrega = CASE WHEN i.fecha_solicitud IS NULL THEN @nuevo ELSE i.lugar_entrega END
    OUTPUT deleted.id_ubicacion INTO @cambio (de_ubicacion)
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.id_ingreso = @id_ingreso
      AND @nuevo IS NOT NULL
      AND i.id_ubicacion <> @id_ubicacion
      AND i.id_liquidacion IS NULL
      AND ISNULL(i.estado_liquidacion, 0) = 0
      AND ISNULL(LTRIM(RTRIM(i.estado_servicio)), '') <> 'cancelado';

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues)
    SELECT @id_ingreso, @id_usuario, @ahora, 'lugar_ingreso', u.nombre_ubicacion, @nuevo
    FROM @cambio c
    LEFT JOIN dbo.tbl_ubicacion_servicios u
        ON u.id_ubicacion = c.de_ubicacion;

    COMMIT TRANSACTION;

    SELECT CAST(COUNT(*) AS BIT) AS Value FROM @cambio;
END;
GO

/* 6. El admin cambia el lugar de entrega: solo si ya se solicitó y no está liquidado ni cancelado. Devuelve 1 si
      cambió */
CREATE OR ALTER PROCEDURE dbo.sp_cambiarLugarEntrega
    @id_ingreso INT,
    @id_usuario INT,
    @lugar_entrega VARCHAR(50),
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @cambio TABLE (antes VARCHAR(100));

    BEGIN TRANSACTION;

    UPDATE i
    SET lugar_entrega = @lugar_entrega
    OUTPUT deleted.lugar_entrega INTO @cambio (antes)
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.id_ingreso = @id_ingreso
      AND NULLIF(LTRIM(RTRIM(@lugar_entrega)), '') IS NOT NULL
      AND ISNULL(i.lugar_entrega, '') <> @lugar_entrega
      AND i.fecha_solicitud IS NOT NULL
      AND i.id_liquidacion IS NULL
      AND ISNULL(i.estado_liquidacion, 0) = 0
      AND ISNULL(LTRIM(RTRIM(i.estado_servicio)), '') <> 'cancelado';

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues)
    SELECT @id_ingreso, @id_usuario, @ahora, 'lugar_entrega', antes, @lugar_entrega
    FROM @cambio;

    COMMIT TRANSACTION;

    SELECT CAST(COUNT(*) AS BIT) AS Value FROM @cambio;
END;
GO

/* 7. El admin pone la foto del comprobante real de un cobro por QR, transferencia o Nequi que no está liquidado.
      La foto nueva reemplaza la anterior. Devuelve 1 si se guardó */
CREATE OR ALTER PROCEDURE dbo.sp_cambiarComprobante
    @id_ingreso INT,
    @id_usuario INT,
    @foto VARBINARY(MAX),
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @cambio TABLE (tenia_foto BIT);

    BEGIN TRANSACTION;

    UPDATE i
    SET foto_transferencia = @foto
    OUTPUT CASE WHEN deleted.foto_transferencia IS NULL THEN 0 ELSE 1 END INTO @cambio (tenia_foto)
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE i.id_ingreso = @id_ingreso
      AND @foto IS NOT NULL
      AND i.estado_pago = 'pagado'
      AND i.metodo_pago IN ('QR', 'Transferencia', 'Nequi')
      AND i.id_liquidacion IS NULL
      AND ISNULL(i.estado_liquidacion, 0) = 0;

    INSERT INTO dbo.tbl_ingresos_cambios (id_ingreso, id_usuario, fecha, campo, antes, despues)
    SELECT @id_ingreso, @id_usuario, @ahora, 'comprobante',
           CASE WHEN tenia_foto = 1 THEN N'Foto anterior' ELSE N'Sin foto' END, N'Foto nueva'
    FROM @cambio;

    COMMIT TRANSACTION;

    SELECT CAST(COUNT(*) AS BIT) AS Value FROM @cambio;
END;
GO

/* 8. Estados del filtro de la tabla de ingresos: se agrega "Cancelado", sin marcar al entrar */
CREATE OR ALTER PROCEDURE dbo.sp_estadosFiltroIngresos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT valor, nombre, CAST(por_defecto AS BIT) AS por_defecto
    FROM (VALUES
        (1, 'esperando valet', 'Esperando valet', 1),
        (2, 'activo',          'Activo',          1),
        (3, 'parqueado',       'Parqueado',       1),
        (4, 'solicitado',      'Solicitado',      1),
        (5, 'despachado',      'Despachado',      1),
        (6, 'finalizado',      'Finalizado',      0),
        (7, 'cancelado',       'Cancelado',       0)
    ) AS e (orden, valor, nombre, por_defecto)
    ORDER BY orden;
END;
GO

/* 9. Igual que en turnos.sql, pero un vehículo cancelado no se ofrece a los bancos de la zona */
CREATE OR ALTER FUNCTION dbo.fn_vehiculosPorRecibir (@id_usuario INT, @id_zona INT, @ahora DATETIME2)
RETURNS TABLE
AS
RETURN
    SELECT
        i.id_ingreso,
        i.placa,
        i.estado_servicio,
        us.nombre_ubicacion,
        COALESCE(i.id_banco_responsable, i.id_banco) AS id_banco_actual,
        i.id_turno
    FROM dbo.tbl_ingresos i
    INNER JOIN dbo.tbl_ubicacion_servicios us
        ON us.id_ubicacion = i.id_ubicacion
    WHERE COALESCE(i.id_zona, us.id_zona) = @id_zona
      AND ISNULL(i.estado_pago, '') <> 'pagado'
      AND ISNULL(i.estado_servicio, '') <> 'finalizado'
      AND ISNULL(i.estado_servicio, '') <> 'cancelado'
      AND COALESCE(i.id_banco_responsable, i.id_banco) <> @id_usuario
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.fn_sesionesAbiertas() s
          WHERE s.id_usuario = COALESCE(i.id_banco_responsable, i.id_banco)
            AND (s.id_rol <> 2
                 OR s.id_turno IS NULL
                 OR DATEADD(HOUR, 1, s.fin_turno) > @ahora
                 OR (s.fin_corrido > @ahora AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))
      );
GO

/* 10. Igual que en turnos.sql, pero los cancelados no pasan a Corrido */
CREATE OR ALTER PROCEDURE dbo.sp_pasarACorrido
    @id_usuario INT,
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @id_sesion INT, @id_corrido INT;

    SELECT TOP 1 @id_sesion = id_sesion, @id_corrido = id_corrido
    FROM dbo.fn_sesionesAbiertas()
    WHERE id_usuario = @id_usuario
      AND id_rol = 2
      AND DATEADD(HOUR, 1, fin_turno) <= @ahora
      AND fin_corrido > @ahora
    ORDER BY id_sesion DESC;

    IF @id_corrido IS NULL
        RETURN;

    BEGIN TRANSACTION;

    UPDATE dbo.tbl_sesiones
    SET id_turno = @id_corrido
    WHERE id_sesion = @id_sesion;

    UPDATE dbo.tbl_ingresos
    SET id_turno = @id_corrido
    WHERE COALESCE(id_banco_responsable, id_banco) = @id_usuario
      AND ISNULL(estado_pago, '') <> 'pagado'
      AND ISNULL(estado_servicio, '') <> 'finalizado'
      AND ISNULL(estado_servicio, '') <> 'cancelado';

    COMMIT TRANSACTION;
END;
GO

PRINT 'Ajustes admin: listo.';
GO
