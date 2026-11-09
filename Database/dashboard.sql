/* =====================================================================
   Cars Parking Service - Dashboard del administrador

   Lo que lee la página Dashboard (DashboardController). Todo se filtra igual:
     @desde, @hasta   días operativos (de 6 am a 6 am: lo de la madrugada es
                      del día en que empezó el turno)
     @zonas, @lugares ids separados por coma ('1,3'); NULL = todos
     @turno, @parqueadero, @usuario (participó en cualquier paso)
     @estado_pago     'pagado' | 'pendiente'
     @metodo_pago     'Efectivo' | 'Transferencia' (QR, Nequi y transferencia)

   El dinero sale de lo LIQUIDADO, por fecha de liquidación, con las mismas
   cuentas de la liquidación (LiquidacionReglas.Calcular). Sin filtros (fuera de
   las fechas) se usan los totales guardados en tbl_liquidacion: así cuadra
   exacto con Estado Turnos - Liquidaciones. Los vehículos se cuentan por su
   fecha de ingreso.

   1. Índices de fecha de ingreso, turno y fecha de liquidación (si no hay)
   2. fn_dashboardIngresos: los vehículos con los filtros
   3. fn_dashboardLiquidaciones: las liquidaciones con sus totales
   4. SPs de cada tablero: sp_dashboardKpis, sp_dashboardRecaudoPor,
      sp_dashboardLiquidacionesPorFecha, sp_dashboardHorasPico,
      sp_dashboardValets, sp_dashboardDistribucion,
      sp_dashboardDetalleLiquidaciones

   - Solo lee: no modifica ni borra datos. Se puede correr más de una vez.
   - Para deshacerlo: dashboard-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Índices. Solo si no hay ya uno que empiece por esa columna (con cualquier nombre) */
IF NOT EXISTS (SELECT 1 FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = OBJECT_ID('dbo.tbl_ingresos') AND ic.key_ordinal = 1 AND c.name = 'fecha_ingreso')
    CREATE INDEX IX_tbl_ingresos_fecha_ingreso ON dbo.tbl_ingresos (fecha_ingreso);

IF NOT EXISTS (SELECT 1 FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = OBJECT_ID('dbo.tbl_ingresos') AND ic.key_ordinal = 1 AND c.name = 'id_turno')
    CREATE INDEX IX_tbl_ingresos_id_turno ON dbo.tbl_ingresos (id_turno);

IF NOT EXISTS (SELECT 1 FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = OBJECT_ID('dbo.tbl_liquidacion') AND ic.key_ordinal = 1 AND c.name = 'fecha')
    CREATE INDEX IX_tbl_liquidacion_fecha ON dbo.tbl_liquidacion (fecha);
GO

/* 2. Vehículos con los filtros. @por_liquidacion = 0: los que ingresaron en esos días;
      1: los liquidados en esos días (con la fecha y quien liquidó).
      efectivo / transferencia / servicio: lo que aporta cada vehículo a su liquidación
      (efectivo sin propina; la propina de una transferencia se paga con el efectivo) */
CREATE OR ALTER FUNCTION dbo.fn_dashboardIngresos
(
    @desde DATE, @hasta DATE, @por_liquidacion BIT,
    @zonas NVARCHAR(500), @lugares NVARCHAR(2000), @turno INT, @parqueadero INT,
    @usuario INT, @estado_pago NVARCHAR(20), @metodo_pago NVARCHAR(20)
)
RETURNS TABLE
AS
RETURN
    SELECT
        i.id_ingreso,
        i.fecha_ingreso,
        CAST(DATEADD(HOUR, -6, i.fecha_ingreso) AS DATE) AS dia_ingreso,
        l.id_liquidacion,
        l.fecha AS fecha_liquidacion,
        CAST(DATEADD(HOUR, -6, l.fecha) AS DATE) AS dia_liquidacion,
        l.id_usuario AS id_liquidador,
        COALESCE(i.id_zona, u.id_zona) AS id_zona,
        i.id_ubicacion,
        i.id_turno,
        i.id_valet,
        i.valet_despacho,
        i.estado_servicio,
        i.estado_pago,
        i.metodo_pago,
        i.rol_cobrador,
        ISNULL(i.estado_liquidacion, 0) AS estado_liquidacion,
        i.fecha_solicitud,
        i.fecha_salida,
        ISNULL(i.valor_servicio, 0) AS servicio,
        CASE WHEN i.metodo_pago = N'Efectivo' THEN ISNULL(i.valor_servicio, 0)
             ELSE -ISNULL(i.valor_propina, 0) END AS efectivo,
        CASE WHEN i.metodo_pago = N'Efectivo' THEN 0
             WHEN ISNULL(i.total_servicio, 0) > 0 THEN i.total_servicio
             ELSE ISNULL(i.valor_servicio, 0) + ISNULL(i.valor_propina, 0) END AS transferencia
    FROM dbo.tbl_ingresos i
    LEFT JOIN dbo.tbl_ubicacion_servicios u ON u.id_ubicacion = i.id_ubicacion
    LEFT JOIN dbo.tbl_liquidacion l ON l.id_liquidacion = i.id_liquidacion
    WHERE ((@por_liquidacion = 0
            AND i.fecha_ingreso >= DATEADD(HOUR, 6, CAST(@desde AS DATETIME2))
            AND i.fecha_ingreso <  DATEADD(HOUR, 30, CAST(@hasta AS DATETIME2)))
        OR (@por_liquidacion = 1
            AND l.fecha >= DATEADD(HOUR, 6, CAST(@desde AS DATETIME2))
            AND l.fecha <  DATEADD(HOUR, 30, CAST(@hasta AS DATETIME2))))
      -- CHARINDEX y no LIKE: no hay comodines (como sp_consultarRegistros)
      AND (@zonas IS NULL OR CHARINDEX(N',' + CAST(COALESCE(i.id_zona, u.id_zona) AS NVARCHAR(12)) + N',', N',' + @zonas + N',') > 0)
      AND (@lugares IS NULL OR CHARINDEX(N',' + CAST(i.id_ubicacion AS NVARCHAR(12)) + N',', N',' + @lugares + N',') > 0)
      AND (@turno IS NULL OR i.id_turno = @turno)
      AND (@parqueadero IS NULL OR i.id_parqueadero = @parqueadero)
      -- Los mismos pasos del filtro "Cómo participó" (DondeParticipo)
      AND (@usuario IS NULL OR @usuario IN (i.id_banco, i.id_valet, i.usuario_parqueo, i.usuario_solicitud,
                                            i.valet_despacho, i.usuario_cobro, l.id_usuario))
      AND (@estado_pago IS NULL
           OR (@estado_pago = N'pagado' AND i.estado_pago = N'pagado')
           OR (@estado_pago = N'pendiente' AND ISNULL(i.estado_pago, N'') <> N'pagado'))
      AND (@metodo_pago IS NULL
           OR (@metodo_pago = N'Efectivo' AND i.metodo_pago = N'Efectivo')
           OR (@metodo_pago = N'Transferencia' AND i.metodo_pago IS NOT NULL AND i.metodo_pago <> N'Efectivo'));
GO

/* 3. Liquidaciones hechas en esos días con sus totales. Sin filtros: los guardados en tbl_liquidacion (los mismos
      de Estado Turnos). Con filtros: la suma de los vehículos que cumplen, con las mismas cuentas */
CREATE OR ALTER FUNCTION dbo.fn_dashboardLiquidaciones
(
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500), @lugares NVARCHAR(2000), @turno INT, @parqueadero INT,
    @usuario INT, @estado_pago NVARCHAR(20), @metodo_pago NVARCHAR(20)
)
RETURNS TABLE
AS
RETURN
    SELECT l.id_liquidacion, l.fecha, CAST(DATEADD(HOUR, -6, l.fecha) AS DATE) AS dia, l.id_usuario,
           ISNULL(l.total_vehiculos, 0) AS vehiculos,
           ISNULL(l.total_efectivo, 0) AS efectivo,
           ISNULL(l.total_transferencias, 0) AS transferencias,
           ISNULL(l.total_liquidado, 0) AS total
    FROM dbo.tbl_liquidacion l
    WHERE l.fecha >= DATEADD(HOUR, 6, CAST(@desde AS DATETIME2))
      AND l.fecha <  DATEADD(HOUR, 30, CAST(@hasta AS DATETIME2))
      AND @zonas IS NULL AND @lugares IS NULL AND @turno IS NULL AND @parqueadero IS NULL
      AND @usuario IS NULL AND @estado_pago IS NULL AND @metodo_pago IS NULL

    UNION ALL

    SELECT r.id_liquidacion, r.fecha_liquidacion, r.dia_liquidacion, r.id_liquidador,
           COUNT(*), SUM(r.efectivo), SUM(r.transferencia), SUM(r.servicio)
    FROM dbo.fn_dashboardIngresos(@desde, @hasta, 1, @zonas, @lugares, @turno, @parqueadero,
                                  @usuario, @estado_pago, @metodo_pago) r
    WHERE NOT (@zonas IS NULL AND @lugares IS NULL AND @turno IS NULL AND @parqueadero IS NULL
               AND @usuario IS NULL AND @estado_pago IS NULL AND @metodo_pago IS NULL)
    GROUP BY r.id_liquidacion, r.fecha_liquidacion, r.dia_liquidacion, r.id_liquidador;
GO

/* 4.1 KPIs del período y del anterior con los mismos días (para la variación %).
       Tiempos en minutos: estadía = ingreso a despacho; despacho = solicitud a despacho */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardKpis
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @dias INT = DATEDIFF(DAY, @desde, @hasta) + 1;
    DECLARE @desde_ant DATE = DATEADD(DAY, -@dias, @desde);
    DECLARE @hasta_ant DATE = DATEADD(DAY, -1, @desde);

    SELECT p.periodo,
           ISNULL(liq.recaudado, 0) AS recaudado,
           ISNULL(liq.efectivo, 0) AS efectivo,
           ISNULL(liq.transferencias, 0) AS transferencias,
           ISNULL(liq.liquidados, 0) AS liquidados,
           veh.atendidos, veh.pendientes_pago, veh.sin_liquidar, veh.deuda_banco,
           veh.estadia_min, veh.despacho_min, veh.cancelados
    FROM (VALUES (N'actual', @desde, @hasta), (N'anterior', @desde_ant, @hasta_ant)) p (periodo, d, h)
    CROSS APPLY (
        SELECT SUM(total) AS recaudado, SUM(efectivo) AS efectivo, SUM(transferencias) AS transferencias,
               SUM(vehiculos) AS liquidados
        FROM dbo.fn_dashboardLiquidaciones(p.d, p.h, @zonas, @lugares, @turno, @parqueadero,
                                           @usuario, @estado_pago, @metodo_pago)
    ) liq
    CROSS APPLY (
        SELECT
            COUNT(CASE WHEN estado_servicio <> N'cancelado' THEN 1 END) AS atendidos,
            COUNT(CASE WHEN estado_servicio <> N'cancelado' AND ISNULL(estado_pago, N'') <> N'pagado' THEN 1 END) AS pendientes_pago,
            COUNT(CASE WHEN estado_pago = N'pagado' AND estado_liquidacion = 0 THEN 1 END) AS sin_liquidar,
            -- Lo que cobraron los valets en efectivo y aún no entra a una liquidación (como Estado Turnos)
            ISNULL(SUM(CASE WHEN rol_cobrador = N'valet' AND metodo_pago = N'Efectivo' AND estado_pago = N'pagado'
                             AND estado_liquidacion = 0 THEN servicio END), 0) AS deuda_banco,
            AVG(CASE WHEN fecha_salida >= fecha_ingreso
                     THEN CAST(DATEDIFF(MINUTE, fecha_ingreso, fecha_salida) AS DECIMAL(18, 2)) END) AS estadia_min,
            AVG(CASE WHEN fecha_salida >= fecha_solicitud
                     THEN CAST(DATEDIFF(MINUTE, fecha_solicitud, fecha_salida) AS DECIMAL(18, 2)) END) AS despacho_min,
            COUNT(CASE WHEN estado_servicio = N'cancelado' THEN 1 END) AS cancelados
        FROM dbo.fn_dashboardIngresos(p.d, p.h, 0, @zonas, @lugares, @turno, @parqueadero,
                                      @usuario, @estado_pago, @metodo_pago)
    ) veh
    OPTION (RECOMPILE);
END;
GO

/* 4.2 Recaudo (liquidado) y vehículos (ingresados) por zona o por lugar. @por = 'zona' | 'lugar' */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardRecaudoPor
    @por NVARCHAR(10), @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH vehiculos AS (
        SELECT ISNULL(CASE WHEN @por = N'zona' THEN id_zona ELSE id_ubicacion END, 0) AS id, COUNT(*) AS vehiculos
        FROM dbo.fn_dashboardIngresos(@desde, @hasta, 0, @zonas, @lugares, @turno, @parqueadero,
                                      @usuario, @estado_pago, @metodo_pago)
        WHERE estado_servicio <> N'cancelado'
        GROUP BY ISNULL(CASE WHEN @por = N'zona' THEN id_zona ELSE id_ubicacion END, 0)
    ),
    recaudo AS (
        SELECT ISNULL(CASE WHEN @por = N'zona' THEN id_zona ELSE id_ubicacion END, 0) AS id, SUM(servicio) AS recaudado
        FROM dbo.fn_dashboardIngresos(@desde, @hasta, 1, @zonas, @lugares, @turno, @parqueadero,
                                      @usuario, @estado_pago, @metodo_pago)
        GROUP BY ISNULL(CASE WHEN @por = N'zona' THEN id_zona ELSE id_ubicacion END, 0)
    )
    SELECT COALESCE(v.id, r.id) AS id,
           COALESCE(CASE WHEN @por = N'zona' THEN z.nombre_zona ELSE u.nombre_ubicacion END,
                    CASE WHEN @por = N'zona' THEN N'Sin zona' ELSE N'Sin lugar' END) AS nombre,
           ISNULL(r.recaudado, 0) AS recaudado,
           ISNULL(v.vehiculos, 0) AS vehiculos
    FROM vehiculos v
    FULL JOIN recaudo r ON r.id = v.id
    LEFT JOIN dbo.tbl_zonas z ON @por = N'zona' AND z.id_zona = COALESCE(v.id, r.id)
    LEFT JOIN dbo.tbl_ubicacion_servicios u ON @por <> N'zona' AND u.id_ubicacion = COALESCE(v.id, r.id)
    ORDER BY recaudado DESC, vehiculos DESC
    OPTION (RECOMPILE);
END;
GO

/* 4.3 Liquidaciones por día, mes o año (@agrupacion = 'dia' | 'mes' | 'anio'), efectivo y transferencias */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardLiquidacionesPorFecha
    @agrupacion NVARCHAR(10), @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CASE @agrupacion WHEN N'anio' THEN DATEFROMPARTS(YEAR(dia), 1, 1)
                            WHEN N'mes' THEN DATEFROMPARTS(YEAR(dia), MONTH(dia), 1)
                            ELSE dia END AS periodo,
           SUM(efectivo) AS efectivo, SUM(transferencias) AS transferencias, SUM(total) AS total,
           SUM(vehiculos) AS vehiculos
    FROM dbo.fn_dashboardLiquidaciones(@desde, @hasta, @zonas, @lugares, @turno, @parqueadero,
                                       @usuario, @estado_pago, @metodo_pago)
    GROUP BY CASE @agrupacion WHEN N'anio' THEN DATEFROMPARTS(YEAR(dia), 1, 1)
                              WHEN N'mes' THEN DATEFROMPARTS(YEAR(dia), MONTH(dia), 1)
                              ELSE dia END
    ORDER BY periodo
    OPTION (RECOMPILE);
END;
GO

/* 4.4 Horas pico: vehículos por día de la semana (1 = lunes ... 7 = domingo, del día operativo) y hora de ingreso */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardHorasPico
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- El 1 de enero de 1900 fue lunes: así no depende de SET DATEFIRST
    SELECT DATEDIFF(DAY, '19000101', dia_ingreso) % 7 + 1 AS dia_semana,
           DATEPART(HOUR, fecha_ingreso) AS hora,
           COUNT(*) AS vehiculos
    FROM dbo.fn_dashboardIngresos(@desde, @hasta, 0, @zonas, @lugares, @turno, @parqueadero,
                                  @usuario, @estado_pago, @metodo_pago)
    WHERE estado_servicio <> N'cancelado'
    GROUP BY DATEDIFF(DAY, '19000101', dia_ingreso) % 7 + 1, DATEPART(HOUR, fecha_ingreso)
    OPTION (RECOMPILE);
END;
GO

/* 4.5 Rendimiento por valet: vehículos que recibió y que despachó, lo pagado de los que recibió y el tiempo
       promedio de despacho (solicitud a despacho) de los que despachó */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardValets
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH f AS (
        SELECT * FROM dbo.fn_dashboardIngresos(@desde, @hasta, 0, @zonas, @lugares, @turno, @parqueadero,
                                               @usuario, @estado_pago, @metodo_pago)
        WHERE estado_servicio <> N'cancelado'
    ),
    pasos AS (
        SELECT id_valet AS id_usuario, 1 AS recibido, 0 AS despachado,
               CASE WHEN estado_pago = N'pagado' THEN servicio ELSE 0 END AS recaudo,
               CAST(NULL AS INT) AS minutos
        FROM f WHERE id_valet IS NOT NULL
        UNION ALL
        SELECT valet_despacho, 0, 1, 0,
               CASE WHEN fecha_salida >= fecha_solicitud THEN DATEDIFF(MINUTE, fecha_solicitud, fecha_salida) END
        FROM f WHERE valet_despacho IS NOT NULL
    )
    SELECT p.id_usuario,
           LTRIM(CONCAT(us.nombres, N' ', us.apellidos)) AS nombre,
           SUM(p.recibido) AS recibidos,
           SUM(p.despachado) AS despachados,
           SUM(p.recaudo) AS recaudo,
           AVG(CAST(p.minutos AS DECIMAL(18, 2))) AS despacho_min
    FROM pasos p
    LEFT JOIN dbo.tbl_usuarios us ON us.id_usuario = p.id_usuario
    GROUP BY p.id_usuario, us.nombres, us.apellidos
    ORDER BY recibidos DESC, despachados DESC
    OPTION (RECOMPILE);
END;
GO

/* 4.6 Distribución: vehículos por turno (los que ingresaron) y por método de pago (los liquidados) */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardDistribucion
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT N'turno' AS grupo,
           CASE WHEN t.id_turno IS NULL THEN N'Sin turno'
                WHEN t.dia_semana IS NULL THEN t.nombre
                ELSE CONCAT(t.nombre, N' (', CHOOSE(t.dia_semana, N'lunes', N'martes', N'miércoles', N'jueves',
                                                    N'viernes', N'sábado', N'domingo'), N')') END AS etiqueta,
           COUNT(*) AS vehiculos,
           ISNULL(SUM(CASE WHEN f.estado_pago = N'pagado' THEN f.servicio END), 0) AS valor
    FROM dbo.fn_dashboardIngresos(@desde, @hasta, 0, @zonas, @lugares, @turno, @parqueadero,
                                  @usuario, @estado_pago, @metodo_pago) f
    LEFT JOIN dbo.tbl_turnos t ON t.id_turno = f.id_turno
    WHERE f.estado_servicio <> N'cancelado'
    GROUP BY t.id_turno, t.nombre, t.dia_semana

    UNION ALL

    SELECT N'metodo',
           CASE WHEN f.metodo_pago = N'Efectivo' THEN N'Efectivo' ELSE N'Transferencia' END,
           COUNT(*),
           SUM(f.servicio)
    FROM dbo.fn_dashboardIngresos(@desde, @hasta, 1, @zonas, @lugares, @turno, @parqueadero,
                                  @usuario, @estado_pago, @metodo_pago) f
    GROUP BY CASE WHEN f.metodo_pago = N'Efectivo' THEN N'Efectivo' ELSE N'Transferencia' END
    OPTION (RECOMPILE);
END;
GO

/* 4.7 Detalle de liquidaciones, de la más reciente a la más antigua, por páginas. total_filas: cuántas hay */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardDetalleLiquidaciones
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL,
    @pagina INT = 1, @tamano INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    IF @pagina IS NULL OR @pagina < 1 SET @pagina = 1;
    IF @tamano IS NULL OR @tamano < 1 OR @tamano > 100000 SET @tamano = 10;

    SELECT l.id_liquidacion, l.fecha,
           ISNULL(NULLIF(LTRIM(CONCAT(us.nombres, N' ', us.apellidos)), N''), N'—') AS funcionario,
           l.vehiculos, l.efectivo, l.transferencias, l.total,
           COUNT(*) OVER () AS total_filas
    FROM dbo.fn_dashboardLiquidaciones(@desde, @hasta, @zonas, @lugares, @turno, @parqueadero,
                                       @usuario, @estado_pago, @metodo_pago) l
    LEFT JOIN dbo.tbl_usuarios us ON us.id_usuario = l.id_usuario
    ORDER BY l.fecha DESC, l.id_liquidacion DESC
    OFFSET (@pagina - 1) * @tamano ROWS FETCH NEXT @tamano ROWS ONLY
    OPTION (RECOMPILE);
END;
GO

PRINT 'Dashboard: índices, funciones y procedimientos listos.';
GO
