/* =====================================================================
   Cars Parking Service - Dashboard: costos de parqueaderos

   Gráfica "Costos de parqueaderos" del dashboard: por cada parqueadero
   alquilado (tarifa mayor que 0), su costo (la tarifa guardada en
   tbl_parqueaderos, sin cálculos) contra lo que se recaudó por los
   vehículos de ese parqueadero, con los mismos filtros del dashboard
   (fn_dashboardIngresos, como sp_dashboardRecaudoPor).

   - Crea sp_dashboardCostosParqueaderos. No modifica ni borra datos y no
     cambia los SPs que ya existen.
   - Va DESPUÉS de dashboard.sql. Se puede correr más de una vez.
   - Para deshacerlo: DROP PROCEDURE dbo.sp_dashboardCostosParqueaderos;
   ===================================================================== */

USE BD_CARS_PARKING;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* Vehículos: los que ingresaron en esos días (sin cancelados). Recaudo: lo liquidado en esos días. Igual que
   "Ingresos por zona" y "por restaurante". Con filtro de zona o de parqueadero, solo esos parqueaderos */
CREATE OR ALTER PROCEDURE dbo.sp_dashboardCostosParqueaderos
    @desde DATE, @hasta DATE,
    @zonas NVARCHAR(500) = NULL, @lugares NVARCHAR(2000) = NULL, @turno INT = NULL, @parqueadero INT = NULL,
    @usuario INT = NULL, @estado_pago NVARCHAR(20) = NULL, @metodo_pago NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH vehiculos AS (
        SELECT i.id_parqueadero AS id, COUNT(*) AS vehiculos
        FROM dbo.fn_dashboardIngresos(@desde, @hasta, 0, @zonas, @lugares, @turno, @parqueadero,
                                      @usuario, @estado_pago, @metodo_pago) f
        JOIN dbo.tbl_ingresos i ON i.id_ingreso = f.id_ingreso
        WHERE f.estado_servicio <> N'cancelado'
        GROUP BY i.id_parqueadero
    ),
    recaudo AS (
        SELECT i.id_parqueadero AS id, SUM(f.servicio) AS recaudado
        FROM dbo.fn_dashboardIngresos(@desde, @hasta, 1, @zonas, @lugares, @turno, @parqueadero,
                                      @usuario, @estado_pago, @metodo_pago) f
        JOIN dbo.tbl_ingresos i ON i.id_ingreso = f.id_ingreso
        GROUP BY i.id_parqueadero
    )
    SELECT p.id_parqueadero AS id,
           p.nombre_parqueadero AS nombre,
           p.tarifa AS costo,
           ISNULL(r.recaudado, 0) AS recaudado,
           ISNULL(v.vehiculos, 0) AS vehiculos
    FROM dbo.tbl_parqueaderos p
    LEFT JOIN vehiculos v ON v.id = p.id_parqueadero
    LEFT JOIN recaudo r ON r.id = p.id_parqueadero
    WHERE p.tarifa > 0
      AND (p.estado = N'activo' OR v.id IS NOT NULL OR r.id IS NOT NULL)
      AND (@parqueadero IS NULL OR p.id_parqueadero = @parqueadero)
      AND (@zonas IS NULL OR CHARINDEX(N',' + CAST(p.id_zona AS NVARCHAR(12)) + N',', N',' + @zonas + N',') > 0)
    ORDER BY costo DESC, recaudado DESC
    OPTION (RECOMPILE);
END;
GO

PRINT 'Listo: sp_dashboardCostosParqueaderos creado (gráfica Costos de parqueaderos del dashboard).';
GO
