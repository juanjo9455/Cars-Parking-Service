/* =====================================================================
   Cars Parking Service - Turnos sin hora de margen y SPs para manejar los turnos

   1. Cuando termina el turno de un banco, sus vehículos sin cobrar quedan de
      una vez para los bancos de su zona que estén de turno, aunque él siga
      conectado (antes había 1 hora de margen). Si cierra sesión antes, quedan
      libres desde ese momento, como antes. Sigue igual: el admin conserva los
      suyos, el banco sin turno conserva los suyos, el de Turno 1 que sigue
      trabajando en Corrido los conserva y los cancelados no se ofrecen.
   2. SPs para ver, crear, activar y desactivar turnos desde SSMS, con las
      reglas que necesita la app. La app lee tbl_turnos cada vez: un turno
      nuevo sirve desde el siguiente inicio de sesión, sin publicar nada.
        EXEC dbo.sp_turnos;
        EXEC dbo.sp_crearTurno @nombre, @dia_semana, @hora_inicio, @hora_fin;
        EXEC dbo.sp_activarTurno @id_turno, @activo;

   - Va DESPUÉS de ajustes-admin.sql. No modifica ni borra datos.
   - Se puede correr más de una vez.
   - Después de correr este, NO vuelvas a correr turnos.sql ni
     ajustes-admin.sql: devolverían la hora de margen.
   - Para deshacerlo: turnos-sin-margen-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Igual que en ajustes-admin.sql, pero sin la hora de margen: el banco conserva lo suyo hasta que termina
      su turno (DATEADD(HOUR, 1, s.fin_turno) pasa a s.fin_turno) */
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
                 OR s.fin_turno > @ahora
                 OR (s.fin_corrido > @ahora AND s.ultima_actividad > DATEADD(MINUTE, -10, @ahora)))
      );
GO

/* 2. Turnos activos que se cruzan con un horario en el mismo día (NULL = todos los días: se cruza con cualquier
      día). La jornada va de 6 am a 6 am: el turno que empieza antes de las 6 am es de madrugada y se cuenta
      después de la medianoche. El Corrido no cuenta: se cruza a propósito con los de la tarde */
CREATE OR ALTER FUNCTION dbo.fn_turnosQueSeCruzan
    (@id_turno_excluir INT, @dia_semana TINYINT, @hora_inicio TIME(0), @hora_fin TIME(0))
RETURNS TABLE
AS
RETURN
    SELECT t.id_turno, t.nombre, t.dia_semana, t.hora_inicio, t.hora_fin
    FROM dbo.tbl_turnos t
    CROSS APPLY (SELECT CASE WHEN t.hora_inicio < '06:00' THEN 1440 ELSE 0 END AS madrugada) tm
    CROSS APPLY (SELECT CASE WHEN @hora_inicio < '06:00' THEN 1440 ELSE 0 END AS madrugada) nm
    WHERE t.activo = 1
      AND t.nombre <> N'Corrido'
      AND (@id_turno_excluir IS NULL OR t.id_turno <> @id_turno_excluir)
      AND (t.dia_semana IS NULL OR @dia_semana IS NULL OR t.dia_semana = @dia_semana)
      -- En minutos desde la medianoche (la madrugada suma un día): se cruzan si cada uno empieza antes de que
      -- el otro termine. Uno que termina a las 3 y otro que empieza a las 3 no se cruzan
      AND DATEDIFF(MINUTE, CAST('00:00' AS TIME(0)), t.hora_inicio) + tm.madrugada
          < DATEDIFF(MINUTE, CAST('00:00' AS TIME(0)), @hora_fin) + nm.madrugada
      AND DATEDIFF(MINUTE, CAST('00:00' AS TIME(0)), @hora_inicio) + nm.madrugada
          < DATEDIFF(MINUTE, CAST('00:00' AS TIME(0)), t.hora_fin) + tm.madrugada;
GO

/* 3. Los turnos como los usa la app: primero los activos. El día es el de la jornada */
CREATE OR ALTER PROCEDURE dbo.sp_turnos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        t.id_turno,
        t.nombre,
        CASE WHEN t.dia_semana IS NULL THEN N'Todos los días'
             ELSE CHOOSE(t.dia_semana, N'Lunes', N'Martes', N'Miércoles', N'Jueves', N'Viernes', N'Sábado', N'Domingo')
        END AS dia,
        CONCAT(CONVERT(VARCHAR(5), t.hora_inicio, 108), ' a ', CONVERT(VARCHAR(5), t.hora_fin, 108)) AS horario,
        CASE WHEN t.nombre = N'Corrido' THEN N'No se da al entrar: lo toma el de Turno 1 que sigue trabajando'
             WHEN t.hora_inicio < '06:00' THEN N'Madrugada: la noche de ese día para el siguiente'
             ELSE N''
        END AS nota,
        t.activo,
        t.orden
    FROM dbo.tbl_turnos t
    ORDER BY t.activo DESC, t.orden, t.id_turno;
END;
GO

/* 4. Crea un turno. Lo toma el banco que inicie sesión después (el que ya está conectado sigue con el suyo hasta
      que vuelva a entrar). Reglas que necesita la app:
      - @dia_semana: 1 = lunes ... 7 = domingo, el día de la jornada; NULL = todos los días
      - No pasa la medianoche: uno de 10 pm a 2 am se crea en dos (22:00 a 23:59 y 00:00 a 02:00)
      - El que empieza antes de las 6 am es de madrugada (la noche del día que dice para el siguiente) y termina
        a más tardar a las 6 am
      - No se cruza con otro turno activo del mismo día
      - El Corrido no se crea aquí: es uno solo */
CREATE OR ALTER PROCEDURE dbo.sp_crearTurno
    @nombre      NVARCHAR(40),
    @dia_semana  TINYINT = NULL,
    @hora_inicio TIME(0),
    @hora_fin    TIME(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @nombre = LTRIM(RTRIM(@nombre));

    IF ISNULL(@nombre, N'') = N''
        THROW 50001, N'Escribe el nombre del turno.', 1;

    IF @nombre = N'Corrido'
        THROW 50002, N'El Corrido ya existe y es uno solo: no se crea otro.', 1;

    IF @dia_semana IS NOT NULL AND @dia_semana NOT BETWEEN 1 AND 7
        THROW 50003, N'@dia_semana va de 1 (lunes) a 7 (domingo), o NULL para todos los días.', 1;

    IF @hora_inicio IS NULL OR @hora_fin IS NULL OR @hora_fin <= @hora_inicio
        THROW 50004, N'La hora de fin debe ser mayor que la de inicio. Si el turno pasa la medianoche, créalo en dos: hasta las 23:59 y desde las 00:00.', 1;

    IF @hora_inicio < '06:00' AND @hora_fin > '06:00'
        THROW 50005, N'Un turno de madrugada (empieza antes de las 6 am) debe terminar a más tardar a las 6 am.', 1;

    DECLARE @cruce NVARCHAR(200), @mensaje NVARCHAR(2048), @orden INT;

    BEGIN TRANSACTION;

    -- Bloquea los turnos mientras se revisa que no se cruce (por si dos personas crean a la vez)
    SELECT @orden = ISNULL(MAX(orden), 0) + 1
    FROM dbo.tbl_turnos WITH (UPDLOCK, HOLDLOCK);

    SELECT TOP 1 @cruce = CONCAT(c.nombre, N' (id ', c.id_turno, N', ',
                                 CONVERT(VARCHAR(5), c.hora_inicio, 108), N' a ', CONVERT(VARCHAR(5), c.hora_fin, 108), N')')
    FROM dbo.fn_turnosQueSeCruzan(NULL, @dia_semana, @hora_inicio, @hora_fin) c
    ORDER BY c.hora_inicio;

    IF @cruce IS NOT NULL
    BEGIN
        SET @mensaje = CONCAT(N'Se cruza con el turno ', @cruce, N'. Cambia el horario o desactiva ese turno primero (sp_activarTurno).');
        THROW 50006, @mensaje, 1;
    END;

    INSERT INTO dbo.tbl_turnos (nombre, dia_semana, hora_inicio, hora_fin, orden)
    VALUES (@nombre, @dia_semana, @hora_inicio, @hora_fin, @orden);

    COMMIT TRANSACTION;

    EXEC dbo.sp_turnos;
END;
GO

/* 5. Activa (@activo = 1) o desactiva (@activo = 0) un turno. Desactivado ya no se le da a nadie al entrar; el
      banco que ya lo tiene sigue con él hasta que vuelva a entrar, y los ingresos viejos lo conservan (sigue en
      los filtros para buscarlos). Para cambiar un horario: desactiva el viejo y crea el nuevo, así lo de antes
      queda con el horario que tenía. No se borran turnos: los usan los ingresos y las sesiones */
CREATE OR ALTER PROCEDURE dbo.sp_activarTurno
    @id_turno INT,
    @activo   BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @activo IS NULL
        THROW 50011, N'@activo es 1 (activar) o 0 (desactivar).', 1;

    DECLARE @nombre NVARCHAR(40), @dia TINYINT, @inicio TIME(0), @fin TIME(0),
            @cruce NVARCHAR(200), @mensaje NVARCHAR(2048), @total INT;

    BEGIN TRANSACTION;

    -- Bloquea los turnos mientras se revisa que no se cruce
    SELECT @total = COUNT(*) FROM dbo.tbl_turnos WITH (UPDLOCK, HOLDLOCK);

    SELECT @nombre = nombre, @dia = dia_semana, @inicio = hora_inicio, @fin = hora_fin
    FROM dbo.tbl_turnos
    WHERE id_turno = @id_turno;

    IF @nombre IS NULL
        THROW 50012, N'No existe ese turno. Míralos con EXEC dbo.sp_turnos.', 1;

    IF @activo = 1 AND @nombre = N'Corrido'
       AND EXISTS (SELECT 1 FROM dbo.tbl_turnos WHERE nombre = N'Corrido' AND activo = 1 AND id_turno <> @id_turno)
        THROW 50013, N'Ya hay otro Corrido activo: solo puede haber uno.', 1;

    IF @activo = 1 AND @nombre <> N'Corrido'
    BEGIN
        SELECT TOP 1 @cruce = CONCAT(c.nombre, N' (id ', c.id_turno, N', ',
                                     CONVERT(VARCHAR(5), c.hora_inicio, 108), N' a ', CONVERT(VARCHAR(5), c.hora_fin, 108), N')')
        FROM dbo.fn_turnosQueSeCruzan(@id_turno, @dia, @inicio, @fin) c
        ORDER BY c.hora_inicio;

        IF @cruce IS NOT NULL
        BEGIN
            SET @mensaje = CONCAT(N'Se cruza con el turno ', @cruce, N'. Desactiva ese turno primero.');
            THROW 50014, @mensaje, 1;
        END;
    END;

    UPDATE dbo.tbl_turnos
    SET activo = @activo
    WHERE id_turno = @id_turno;

    COMMIT TRANSACTION;

    EXEC dbo.sp_turnos;
END;
GO

PRINT 'Turnos sin margen: listo.';
GO
