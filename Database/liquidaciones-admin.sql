/* =====================================================================
   Cars Parking Service - Liquidaciones en el panel del administrador

   - Correr ANTES de publicar el código: la página Liquidaciones y el
     "Ver detalle" de Estado de turnos (DetalleLiquidacion) llaman a
     estos procedimientos.
   - Volver a correrlo al publicar la rama liquidacion-propinas: el detalle de
     cada vehículo ahora trae la propina y lo cobrado (sp_vehiculosLiquidacion).
   - No modifica ni borra datos. Solo crea (o actualiza) 2 procedimientos y
     borra sp_funcionariosLiquidaciones, que ya no se usa (el filtro lista
     todos los usuarios con sp_consultarUsuarios).
   - Se puede correr más de una vez.
   - Para deshacerlo: liquidaciones-admin-revertir.sql
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 1. Liquidaciones, la más reciente primero. Cada filtro es opcional (NULL = todos):
      @id_usuario   el funcionario que liquidó
      @fecha_inicio desde ese día (incluido)
      @fecha_fin    hasta ese día (incluido) */
CREATE OR ALTER PROCEDURE dbo.sp_consultarLiquidaciones
    @id_usuario   INT  = NULL,
    @fecha_inicio DATE = NULL,
    @fecha_fin    DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        l.id_liquidacion,
        l.fecha,
        l.id_usuario,
        -- Si el usuario ya no existe queda vacío; la página muestra un guion
        LTRIM(RTRIM(CONCAT(u.nombres, ' ', u.apellidos))) AS funcionario,
        ISNULL(l.total_efectivo, 0)       AS total_efectivo,
        ISNULL(l.total_transferencias, 0) AS total_transferencias,
        ISNULL(l.total_liquidado, 0)      AS total_liquidado,
        ISNULL(l.total_vehiculos, 0)      AS total_vehiculos
    FROM dbo.tbl_liquidacion l
    LEFT JOIN dbo.tbl_usuarios u
        ON u.id_usuario = l.id_usuario
    WHERE (@id_usuario IS NULL OR l.id_usuario = @id_usuario)
      -- La columna se compara sin convertirla, para que SQL Server pueda usar un índice por fecha
      AND (@fecha_inicio IS NULL OR l.fecha >= @fecha_inicio)
      AND (@fecha_fin IS NULL OR l.fecha < DATEADD(DAY, 1, @fecha_fin))
    ORDER BY l.fecha DESC, l.id_liquidacion DESC
    -- Filtros opcionales: un plan para cada combinación, en vez de reusar uno que no sirve
    OPTION (RECOMPILE);
END;
GO

/* 2. Vehículos de una liquidación, en el orden en que se entregaron.
      Solo las columnas que se muestran (no trae las fotos del ingreso). Con la propina y lo que entró de
      verdad por cada carro (total_cobrado; cobros de antes sin total: servicio + propina) */
CREATE OR ALTER PROCEDURE dbo.sp_vehiculosLiquidacion
    @id_liquidacion INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        i.placa,
        i.fecha_entrega,
        LTRIM(RTRIM(CONCAT(u.nombres, ' ', u.apellidos))) AS cobro,
        i.rol_cobrador,
        i.metodo_pago,
        ISNULL(i.valor_servicio, 0) AS valor_servicio,
        ISNULL(i.valor_propina, 0) AS valor_propina,
        CASE WHEN ISNULL(i.total_servicio, 0) > 0
             THEN i.total_servicio
             ELSE ISNULL(i.valor_servicio, 0) + ISNULL(i.valor_propina, 0)
        END AS total_cobrado,
        us.nombre_ubicacion
    FROM dbo.tbl_ingresos i
    LEFT JOIN dbo.tbl_usuarios u
        ON u.id_usuario = i.usuario_cobro
    LEFT JOIN dbo.tbl_ubicacion_servicios us
        ON us.id_ubicacion = i.id_ubicacion
    WHERE i.id_liquidacion = @id_liquidacion
    ORDER BY i.fecha_entrega;
END;
GO

/* 3. Ya no se usa: el filtro lista todos los usuarios, porque cualquiera puede llegar a cobrar.
      Se borra si quedó de una versión anterior de este script */
DROP PROCEDURE IF EXISTS dbo.sp_funcionariosLiquidaciones;
GO

PRINT 'Liquidaciones del administrador: procedimientos listos.';
GO
