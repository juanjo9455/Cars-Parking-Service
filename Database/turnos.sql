/* =====================================================================
   Cars Parking Service - Turnos y herencia de vehículos entre bancos

   El turno del banco sale de la hora a la que entra. Al terminar su turno
   tiene una hora de margen; si sigue trabajando después y el Corrido cubre
   su turno (Turno 1), pasa a Corrido con sus vehículos sin cobrar. Cuando
   un banco entra, si en su zona hay vehículos sin cobrar de un banco que ya
   no está, le sale una ventana para recibirlos (si entran varios, se ponen
   de acuerdo: cada uno escoge cuáles recibe). Al recibirlos cambian de
   banco a cargo y de turno, y el traspaso queda registrado.

   - Correr ANTES de publicar la versión que usa los turnos: si no, la app
     falla al buscar tablas y columnas que todavía no existen.
   - Crea tbl_turnos (con los horarios) y tbl_traspasos; agrega columnas que
     aceptan NULL: tbl_ingresos.id_turno, tbl_ingresos.id_banco_responsable
     (NULL = el banco que registró el ingreso) y tbl_sesiones.id_turno.
     No modifica ni borra datos existentes.
   - Crea fn_sesionesAbiertas, fn_vehiculosPorRecibir, sp_pasarACorrido,
     sp_vehiculosPorRecibir y sp_recibirVehiculos, y actualiza
     sp_consultarRegistros para que el banco vea también los vehículos que
     recibió.
   - Se puede correr más de una vez: cada paso revisa si ya está hecho.
   - Para deshacerlo: turnos-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Turnos. dia_semana: 1 = lunes ... 7 = domingo; NULL = todos los días. Es el día de la jornada, que
    --    empieza a las 6 am: la madrugada del jueves (12 a 2 am) es el día 4 aunque en el calendario ya sea viernes
    IF OBJECT_ID('dbo.tbl_turnos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.tbl_turnos (
            id_turno    INT IDENTITY(1, 1) CONSTRAINT PK_tbl_turnos PRIMARY KEY,
            nombre      NVARCHAR(40) NOT NULL,
            dia_semana  TINYINT NULL CONSTRAINT CK_tbl_turnos_dia_semana CHECK (dia_semana BETWEEN 1 AND 7),
            hora_inicio TIME(0) NOT NULL,
            hora_fin    TIME(0) NOT NULL,
            orden       INT NOT NULL,
            activo      BIT NOT NULL CONSTRAINT DF_tbl_turnos_activo DEFAULT 1
        );

        INSERT INTO dbo.tbl_turnos (nombre, dia_semana, hora_inicio, hora_fin, orden) VALUES
            (N'Turno 1',   NULL, '12:00', '15:00', 1),
            (N'Turno 2',   NULL, '15:00', '18:00', 2),
            (N'Noche',     NULL, '18:00', '23:00', 3),
            (N'Madrugada', 4,    '00:00', '02:00', 4),   -- jueves para viernes
            (N'Madrugada', 5,    '00:00', '04:00', 5),   -- viernes para sábado
            (N'Madrugada', 6,    '00:00', '04:00', 6),   -- sábado para domingo
            (N'Corrido',   NULL, '12:00', '18:00', 7);
    END;

    -- 2. En qué turno entró el vehículo (cambia si otro banco lo recibe) y quién lo debe cobrar ahora
    IF COL_LENGTH('dbo.tbl_ingresos', 'id_turno') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD id_turno INT NULL
            CONSTRAINT FK_tbl_ingresos_id_turno REFERENCES dbo.tbl_turnos (id_turno);

    IF COL_LENGTH('dbo.tbl_ingresos', 'id_banco_responsable') IS NULL
        ALTER TABLE dbo.tbl_ingresos ADD id_banco_responsable INT NULL
            CONSTRAINT FK_tbl_ingresos_id_banco_responsable REFERENCES dbo.tbl_usuarios (id_usuario);

    -- 3. El turno del banco: el de la hora a la que entró (Corrido si se quedó)
    IF COL_LENGTH('dbo.tbl_sesiones', 'id_turno') IS NULL
        ALTER TABLE dbo.tbl_sesiones ADD id_turno INT NULL
            CONSTRAINT FK_tbl_sesiones_id_turno REFERENCES dbo.tbl_turnos (id_turno);

    -- 4. Registro de cada vehículo que pasó de un banco a otro
    IF OBJECT_ID('dbo.tbl_traspasos', 'U') IS NULL
        CREATE TABLE dbo.tbl_traspasos (
            id_traspaso INT IDENTITY(1, 1) CONSTRAINT PK_tbl_traspasos PRIMARY KEY,
            id_ingreso  INT NOT NULL CONSTRAINT FK_tbl_traspasos_ingreso REFERENCES dbo.tbl_ingresos (id_ingreso) ON DELETE CASCADE,
            de_banco    INT NULL CONSTRAINT FK_tbl_traspasos_de_banco REFERENCES dbo.tbl_usuarios (id_usuario),
            a_banco     INT NOT NULL CONSTRAINT FK_tbl_traspasos_a_banco REFERENCES dbo.tbl_usuarios (id_usuario),
            de_turno    INT NULL CONSTRAINT FK_tbl_traspasos_de_turno REFERENCES dbo.tbl_turnos (id_turno),
            a_turno     INT NULL CONSTRAINT FK_tbl_traspasos_a_turno REFERENCES dbo.tbl_turnos (id_turno),
            fecha       DATETIME NOT NULL
        );

    COMMIT TRANSACTION;
    PRINT 'Turnos: tablas y columnas listas.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'Turnos: hubo un error y no se aplicó ningún cambio.';
    THROW;
END CATCH;
GO

/* 5. Sesiones abiertas con la hora en que termina su turno: la hora de fin en la jornada en que entró (la jornada
      empieza a las 6 am; los turnos de madrugada terminan al día siguiente). Si el Corrido cubre ese turno
      (Turno 1), también cuándo termina el Corrido */
CREATE OR ALTER FUNCTION dbo.fn_sesionesAbiertas ()
RETURNS TABLE
AS
RETURN
    SELECT
        s.id_sesion,
        s.id_usuario,
        s.id_rol,
        s.id_turno,
        s.ultima_actividad,
        DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00' AS TIME(0)), t.hora_fin), j.dia) AS fin_turno,
        c.id_turno AS id_corrido,
        DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00' AS TIME(0)), c.hora_fin), j.dia) AS fin_corrido
    FROM dbo.tbl_sesiones s
    LEFT JOIN dbo.tbl_turnos t
        ON t.id_turno = s.id_turno
    CROSS APPLY (SELECT CAST(DATEADD(DAY, CASE WHEN t.hora_inicio < '06:00' THEN 1 ELSE 0 END,
                                     CAST(DATEADD(HOUR, -6, s.fecha_inicio) AS DATE)) AS DATETIME2) AS dia) j
    LEFT JOIN dbo.tbl_turnos c
        ON c.nombre = N'Corrido' AND c.activo = 1
       AND t.hora_inicio >= '06:00' AND c.hora_inicio <= t.hora_inicio AND t.hora_fin < c.hora_fin
    WHERE s.fecha_fin IS NULL;
GO

/* 6. Vehículos que un banco puede recibir: sin cobrar, en su zona, de alguien que ya no está. Sigue a cargo de lo
      suyo quien tiene la sesión abierta y: no es banco (el admin), o es banco sin turno, o su turno no ha
      terminado, o está en la hora de margen después del fin, o el Corrido cubre su turno y lo usó en los últimos
      10 minutos (sigue trabajando: con su próxima actividad pasa a Corrido, sp_pasarACorrido). @ahora lo manda
      la app, para usar la misma hora con la que guarda los turnos */
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

/* 7. El banco que sigue trabajando después de la hora de margen de su turno pasa a Corrido, si el Corrido cubre su
      turno y no ha terminado (el de Turno 1 entre las 4 y las 6 pm). Con él pasan a Corrido sus vehículos sin
      cobrar; los cobrados se quedan en su turno. Lo llama la app con la actividad del banco (KeepAlive) */
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
      AND ISNULL(estado_servicio, '') <> 'finalizado';

    COMMIT TRANSACTION;
END;
GO

/* 8. Lo que ve el banco en la ventana "Vehículos pendientes del turno anterior". Solo si él está de turno de banco */
CREATE OR ALTER PROCEDURE dbo.sp_vehiculosPorRecibir
    @id_usuario INT,
    @id_zona INT,
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.tbl_sesiones
                   WHERE id_usuario = @id_usuario AND id_rol = 2 AND fecha_fin IS NULL AND id_turno IS NOT NULL)
        RETURN;

    SELECT
        v.id_ingreso,
        v.placa,
        v.estado_servicio,
        v.nombre_ubicacion,
        LTRIM(RTRIM(CONCAT(u.nombres, ' ', u.apellidos))) AS banco_anterior,
        t.nombre AS turno_anterior
    FROM dbo.fn_vehiculosPorRecibir(@id_usuario, @id_zona, @ahora) v
    LEFT JOIN dbo.tbl_usuarios u
        ON u.id_usuario = v.id_banco_actual
    LEFT JOIN dbo.tbl_turnos t
        ON t.id_turno = v.id_turno
    ORDER BY v.placa;
END;
GO

/* 9. El banco recibe los vehículos que escogió (@ids: '12,15,20'). Solo los que todavía estén por recibir:
      si dos bancos aceptan a la vez, el segundo espera al primero y ya no los encuentra. Cada vehículo pasa al
      banco y al turno de quien lo recibe, y queda el traspaso. Devuelve cada vehículo pedido: si lo recibió y,
      si no, quién lo tiene */
CREATE OR ALTER PROCEDURE dbo.sp_recibirVehiculos
    @id_usuario INT,
    @id_zona INT,
    @ids VARCHAR(MAX),
    @ahora DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @turno INT = (SELECT TOP 1 id_turno FROM dbo.tbl_sesiones
                          WHERE id_usuario = @id_usuario AND id_rol = 2 AND fecha_fin IS NULL AND id_turno IS NOT NULL
                          ORDER BY fecha_inicio DESC);

    DECLARE @pedidos TABLE (id_ingreso INT PRIMARY KEY);
    DECLARE @recibidos TABLE (id_ingreso INT PRIMARY KEY, de_banco INT, de_turno INT);

    BEGIN TRANSACTION;

    -- Bloquea los vehículos pedidos mientras se revisa que sigan por recibir
    INSERT INTO @pedidos (id_ingreso)
    SELECT i.id_ingreso
    FROM dbo.tbl_ingresos i WITH (UPDLOCK, HOLDLOCK)
    WHERE CHARINDEX(',' + CAST(i.id_ingreso AS VARCHAR(12)) + ',', ',' + REPLACE(@ids, ' ', '') + ',') > 0;

    IF @turno IS NOT NULL
    BEGIN
        UPDATE i
        SET id_banco_responsable = @id_usuario,
            id_turno = @turno
        OUTPUT inserted.id_ingreso, COALESCE(deleted.id_banco_responsable, deleted.id_banco), deleted.id_turno
            INTO @recibidos (id_ingreso, de_banco, de_turno)
        FROM dbo.tbl_ingresos i
        WHERE i.id_ingreso IN (SELECT id_ingreso FROM @pedidos)
          AND i.id_ingreso IN (SELECT id_ingreso FROM dbo.fn_vehiculosPorRecibir(@id_usuario, @id_zona, @ahora));

        INSERT INTO dbo.tbl_traspasos (id_ingreso, de_banco, a_banco, de_turno, a_turno, fecha)
        SELECT id_ingreso, de_banco, @id_usuario, de_turno, @turno, @ahora
        FROM @recibidos;
    END;

    COMMIT TRANSACTION;

    SELECT
        i.id_ingreso,
        i.placa,
        CAST(CASE WHEN r.id_ingreso IS NULL THEN 0 ELSE 1 END AS BIT) AS recibido,
        LTRIM(RTRIM(CONCAT(u.nombres, ' ', u.apellidos))) AS banco_actual
    FROM @pedidos p
    INNER JOIN dbo.tbl_ingresos i
        ON i.id_ingreso = p.id_ingreso
    LEFT JOIN @recibidos r
        ON r.id_ingreso = p.id_ingreso
    LEFT JOIN dbo.tbl_usuarios u
        ON u.id_usuario = COALESCE(i.id_banco_responsable, i.id_banco)
    ORDER BY i.placa;
END;
GO

/* 10. sp_consultarRegistros: el banco ve los vehículos que tiene a cargo (los que registró y los que recibió;
      los que entregó a otro banco ya no). Lo demás queda igual que en zonas.sql */
CREATE OR ALTER PROCEDURE [dbo].[sp_consultarRegistros]
    @placa VARCHAR(20) = NULL,
    @lugar VARCHAR(50) = NULL,
    @estado_servicio VARCHAR(500) = NULL,
    @estado_pago VARCHAR(20) = NULL,
    @id_usuario INT = NULL,
    @parqueadero VARCHAR(50) = NULL,
    @fecha_inicio DATE = NULL,
    @fecha_fin DATE = NULL,
    @id_ubicacion int = NULL,
    @id_zona INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @placa = CASE
                    WHEN @placa IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@placa)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@placa))
                 END;

    SET @lugar = CASE
                    WHEN @lugar IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@lugar)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@lugar))
                 END;

    -- Sin espacios alrededor de las comas, para que 'activo, parqueado' también sirva.
    -- Vacío queda '' (no ' '): así sigue trayendo los ingresos sin estado, como antes
    SET @estado_servicio = CASE
                    WHEN @estado_servicio IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@estado_servicio)) = '' THEN ''
                    ELSE REPLACE(REPLACE(LTRIM(RTRIM(@estado_servicio)), ' ,', ','), ', ', ',')
                 END;

    SET @estado_pago = CASE
                    WHEN @estado_pago IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@estado_pago)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@estado_pago))
                 END;

    SET @parqueadero = CASE
                    WHEN @parqueadero IS NULL THEN NULL
                    WHEN LTRIM(RTRIM(@parqueadero)) = '' THEN ' '
                    ELSE LTRIM(RTRIM(@parqueadero))
                 END;

    SELECT
        i.*,
        u.nombre_ubicacion,
        p.nombre_parqueadero

    FROM dbo.tbl_ingresos i

    INNER JOIN dbo.tbl_ubicacion_servicios u
        ON i.id_ubicacion = u.id_ubicacion

    INNER JOIN dbo.tbl_parqueaderos p
        ON i.id_parqueadero = p.id_parqueadero

    WHERE
        (@placa IS NULL OR i.placa = @placa)

        AND (@lugar IS NULL OR u.nombre_ubicacion = @lugar)

        -- El estado del ingreso tiene que estar en la lista. CHARINDEX y no LIKE: no hay comodines
        AND (@estado_servicio IS NULL
             OR CHARINDEX(',' + LTRIM(RTRIM(i.estado_servicio)) + ',', ',' + @estado_servicio + ',') > 0)

        AND (@estado_pago IS NULL OR i.estado_pago = @estado_pago)

        -- El banco a cargo: el que lo registró o el que lo recibió en un cambio de turno
        AND (
            @id_usuario IS NULL
            OR i.id_valet = @id_usuario
            OR COALESCE(i.id_banco_responsable, i.id_banco) = @id_usuario
        )

        AND (@parqueadero IS NULL OR p.nombre_parqueadero = @parqueadero)

        AND (
            (@fecha_inicio IS NULL OR CAST(i.fecha_ingreso AS DATE) >= @fecha_inicio)
            AND (@fecha_fin IS NULL OR CAST(i.fecha_ingreso AS DATE) < DATEADD(DAY, 1, @fecha_fin))
        )

        AND (@id_ubicacion IS NULL OR i.id_ubicacion = @id_ubicacion)

        -- Zona del ingreso; los que aún no la tienen guardada toman la de su ubicación
        AND (@id_zona IS NULL OR COALESCE(i.id_zona, u.id_zona) = @id_zona);

END;
GO

-- Verificación
SELECT id_turno, nombre, dia_semana, hora_inicio, hora_fin, orden FROM dbo.tbl_turnos ORDER BY orden;
SELECT name AS objeto, type_desc AS tipo FROM sys.objects
WHERE name IN ('tbl_turnos', 'tbl_traspasos', 'fn_sesionesAbiertas', 'fn_vehiculosPorRecibir', 'sp_pasarACorrido', 'sp_vehiculosPorRecibir', 'sp_recibirVehiculos', 'sp_consultarRegistros');
GO
