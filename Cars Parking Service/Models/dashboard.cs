namespace CarsParkingService.Models
{
    // Resultados de Database/dashboard.sql (página Dashboard del administrador).
    // No son tablas: se leen con Database.SqlQueryRaw, como liquidacion_consulta

    // sp_dashboardKpis: una fila del período ("actual") y otra del anterior con los mismos días ("anterior")
    public class dashboard_kpi
    {
        public string periodo { get; set; } = "";
        public decimal recaudado { get; set; }
        public decimal efectivo { get; set; }
        public decimal transferencias { get; set; }
        public int liquidados { get; set; }
        public int atendidos { get; set; }
        public int pendientes_pago { get; set; }
        public int sin_liquidar { get; set; }
        public decimal deuda_banco { get; set; }
        public decimal? estadia_min { get; set; }
        public decimal? despacho_min { get; set; }
        public int cancelados { get; set; }
    }

    // sp_dashboardRecaudoPor: una zona o un lugar
    public class dashboard_grupo
    {
        public int id { get; set; }
        public string nombre { get; set; } = "";
        public decimal recaudado { get; set; }
        public int vehiculos { get; set; }
    }

    // sp_dashboardLiquidacionesPorFecha: un día, mes o año
    public class dashboard_periodo
    {
        public DateTime periodo { get; set; }
        public decimal efectivo { get; set; }
        public decimal transferencias { get; set; }
        public decimal total { get; set; }
        public int vehiculos { get; set; }
    }

    // sp_dashboardHorasPico: día de la semana (1 = lunes) y hora
    public class dashboard_hora
    {
        public int dia_semana { get; set; }
        public int hora { get; set; }
        public int vehiculos { get; set; }
    }

    // sp_dashboardValets
    public class dashboard_valet
    {
        public int id_usuario { get; set; }
        public string nombre { get; set; } = "";
        public int recibidos { get; set; }
        public int despachados { get; set; }
        public decimal recaudo { get; set; }
        public decimal? despacho_min { get; set; }
    }

    // sp_dashboardDistribucion: grupo "turno" o "metodo"
    public class dashboard_distribucion
    {
        public string grupo { get; set; } = "";
        public string etiqueta { get; set; } = "";
        public int vehiculos { get; set; }
        public decimal valor { get; set; }
    }

    // sp_dashboardDetalleLiquidaciones: una liquidación; total_filas es cuántas hay en total (paginación)
    public class dashboard_liquidacion
    {
        public int id_liquidacion { get; set; }
        public DateTime? fecha { get; set; }
        public string funcionario { get; set; } = "";
        public int vehiculos { get; set; }
        public decimal efectivo { get; set; }
        public decimal transferencias { get; set; }
        public decimal total { get; set; }
        public int total_filas { get; set; }
    }

    // sp_turnos (Database/turnos-sin-margen.sql): la lista del filtro Turno
    public class dashboard_turno
    {
        public int id_turno { get; set; }
        public string nombre { get; set; } = "";
        public string dia { get; set; } = "";
        public bool activo { get; set; }
    }
}
