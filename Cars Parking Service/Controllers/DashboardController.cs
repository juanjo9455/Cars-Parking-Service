using CarsParkingService.Data;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace CarsParkingService.Controllers
{
    // Dashboard del administrador (menú "Dashboard"). La página trae los filtros y cada tablero se llena con su
    // endpoint JSON. Todo sale de los SPs de Database/dashboard.sql, con los mismos filtros
    public class DashboardController : Controller
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Filtros de la barra (los mismos nombres de la URL). Fechas: días operativos, de 6 am a 6 am
        public class Filtros
        {
            public DateTime? desde { get; set; }
            public DateTime? hasta { get; set; }
            public string? agrupacion { get; set; }
            public int[]? zona { get; set; }
            public int[]? lugar { get; set; }
            public int? turno { get; set; }
            public int? parqueadero { get; set; }
            public int? usuario { get; set; }
            public string? estado_pago { get; set; }
            public string? metodo_pago { get; set; }
        }

        // Solo el administrador. Sin sesión, al login (como HomeController); los endpoints responden 401 / 403
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var esPagina = context.ActionDescriptor.RouteValues["action"] == nameof(Index);

            if (string.IsNullOrEmpty(HttpContext.Session.GetString("dni")))
            {
                context.Result = esPagina ? RedirectToAction("Login", "Auth") : Unauthorized();
                return;
            }

            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                context.Result = esPagina ? RedirectToAction("Index", "Home") : StatusCode(403);
                return;
            }

            HttpContext.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            base.OnActionExecuting(context);
        }

        [HttpGet]
        public IActionResult Index()
        {
            ViewBag.Zonas = _context.zonas.FromSqlRaw("EXEC sp_zonas").AsNoTracking().ToList();

            // Todos los lugares y parqueaderos, también los inactivos: tienen historia
            ViewBag.Lugares = _context.ubicacion_servicios.AsNoTracking()
                .OrderBy(u => u.nombre_ubicacion)
                .Select(u => new { u.id_ubicacion, u.nombre_ubicacion, u.id_zona })
                .ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.AsNoTracking()
                .OrderBy(p => p.nombre_parqueadero)
                .Select(p => new { p.id_parqueadero, p.nombre_parqueadero })
                .ToList();
            ViewBag.Turnos = _context.Database.SqlQueryRaw<dashboard_turno>("EXEC sp_turnos").ToList();
            ViewBag.Usuarios = _context.usuarios.AsNoTracking()
                .Where(u => u.estado)
                .OrderBy(u => u.nombres).ThenBy(u => u.apellidos)
                .Select(u => new { u.id_usuario, nombre = u.nombres + " " + u.apellidos, u.id_rol })
                .ToList();

            return View();
        }

        [HttpGet]
        public IActionResult GetKpis([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_kpi>("sp_dashboardKpis", f));

        [HttpGet]
        public IActionResult GetIngresosPorZona([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_grupo>("sp_dashboardRecaudoPor", f, new SqlParameter("@por", "zona")));

        [HttpGet]
        public IActionResult GetIngresosPorLugar([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_grupo>("sp_dashboardRecaudoPor", f, new SqlParameter("@por", "lugar")));

        [HttpGet]
        public IActionResult GetLiquidacionesPorFecha([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_periodo>("sp_dashboardLiquidacionesPorFecha", f,
                new SqlParameter("@agrupacion", f.agrupacion is "mes" or "anio" ? f.agrupacion : "dia")));

        [HttpGet]
        public IActionResult GetHorasPico([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_hora>("sp_dashboardHorasPico", f));

        [HttpGet]
        public IActionResult GetRendimientoValets([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_valet>("sp_dashboardValets", f));

        [HttpGet]
        public IActionResult GetDistribucion([FromQuery] Filtros f) =>
            Json(Consultar<dashboard_distribucion>("sp_dashboardDistribucion", f));

        // Detalle de liquidaciones por páginas; la exportación a Excel pide todas (tamano grande)
        [HttpGet]
        public IActionResult GetDetalleLiquidaciones([FromQuery] Filtros f, int pagina = 1, int tamano = 10) =>
            Json(Consultar<dashboard_liquidacion>("sp_dashboardDetalleLiquidaciones", f,
                new SqlParameter("@pagina", Math.Max(1, pagina)),
                new SqlParameter("@tamano", Math.Clamp(tamano, 1, 100000))));

        // Ejecuta el SP con los filtros (parámetros, nada concatenado) más los suyos propios
        private List<T> Consultar<T>(string sp, Filtros f, params SqlParameter[] propios)
        {
            // Sin fechas: el día operativo de hoy (antes de las 6 am todavía es el de ayer)
            var hoy = DateTime.Now.AddHours(-6).Date;
            var desde = (f.desde ?? f.hasta ?? hoy).Date;
            var hasta = (f.hasta ?? f.desde ?? hoy).Date;
            if (hasta < desde) (desde, hasta) = (hasta, desde);

            static object Lista(int[]? ids) => ids is { Length: > 0 } ? string.Join(",", ids.Distinct()) : DBNull.Value;
            static object Valor(object? v) => v ?? DBNull.Value;

            var parametros = propios.Concat(new[]
            {
                new SqlParameter("@desde", System.Data.SqlDbType.Date) { Value = desde },
                new SqlParameter("@hasta", System.Data.SqlDbType.Date) { Value = hasta },
                new SqlParameter("@zonas", Lista(f.zona)),
                new SqlParameter("@lugares", Lista(f.lugar)),
                new SqlParameter("@turno", Valor(f.turno)),
                new SqlParameter("@parqueadero", Valor(f.parqueadero)),
                new SqlParameter("@usuario", Valor(f.usuario)),
                // Solo los valores que conoce el SP; cualquier otro es "todos"
                new SqlParameter("@estado_pago", Valor(f.estado_pago is "pagado" or "pendiente" ? f.estado_pago : null)),
                new SqlParameter("@metodo_pago", Valor(f.metodo_pago is "Efectivo" or "Transferencia" ? f.metodo_pago : null))
            }).ToArray();

            var nombres = string.Join(", ", parametros.Select(p => $"{p.ParameterName} = {p.ParameterName}"));
            return _context.Database.SqlQueryRaw<T>($"EXEC {sp} {nombres}", parametros).ToList();
        }
    }
}
