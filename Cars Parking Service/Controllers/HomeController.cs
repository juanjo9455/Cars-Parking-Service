using AspNetCoreGeneratedDocument;
using CarsParkingService.Data;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.IdentityModel.Tokens;
using Microsoft.JSInterop.Infrastructure;
using NuGet.Common;
using System.Diagnostics;
using System.Text;
using CarsParkingService.ViewModels;
using Microsoft.DotNet.Scaffolding.Shared.Messaging;
using CarsParkingService.Helpers;

namespace CarsParkingService.Controllers
{
    public class HomeController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public HomeController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public class FinalizarServicioDTO
        {
            public int Id { get; set; }
            public string? EstadoServicio { get; set; }
            public string? FotoBase64 { get; set; }
        }

        public class ParqueaderoDTO
        {
            public int idParqueadero { get; set; }
        }


        public IActionResult Index()
        {

            // Si existe un parqueadero seleccionado, lo eliminamos
            HttpContext.Session.Remove("id_parqueadero_sesion");

            ViewBag.mostrarMenu = true;

            var usuarioId = HttpContext.Session.GetInt32("id");

            var nombreUbicacion = (from s in _context.sesiones
                                   join u in _context.ubicacion_servicios
                                   on s.id_ubicacion equals u.id_ubicacion
                                   where s.id_usuario == usuarioId
                                         && s.fecha_fin == null
                                   select u.nombre_ubicacion)
                                  .FirstOrDefault();

            ViewBag.ubicacion = nombreUbicacion ?? "Ubicación no disponible";

            // Lo que este usuario tiene pagado sin liquidar (una ubicación por cada vehículo)
            var pendientes = usuarioId.HasValue
                ? LiquidacionReglas.PorLiquidar(_context, usuarioId.Value).Select(i => i.id_ubicacion).ToList()
                : new List<int>();

            ViewBag.estadoLiquidacion = pendientes.Count == 0;   // true = puede cerrar sesión
            ViewBag.pendientesVehiculos = pendientes.Count;
            ViewBag.pendientesUbicaciones = pendientes.Distinct().Count();

            return View();

        }

        public IActionResult Login()
        {

            return View();
        }

        public IActionResult Liquidacion()
        {

            var idUsuario = HttpContext.Session.GetInt32("id");
            var idRol = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuario.HasValue || idRol != 2)
            {
                return Forbid();
            }

            var ingresos = _context.ingresos
                .Where(i =>
                       i.id_banco == idUsuario.Value &&
                       i.estado_liquidacion == false &&
                       i.estado_pago == "pagado")
                    .ToList();

            var totalVehiculos = ingresos.Count;

            var totalEfectivo = ingresos
                .Where(i =>
                       i.metodo_pago == "efectivo")
                .Sum(i => i.valor_servicio);

            var totalTransferencia = ingresos
                .Where(i =>
                       i.metodo_pago == "transferencia")
                .Sum(i => i.valor_servicio);

            var totalPropinas = ingresos
                .Sum(i => i.valor_propina ?? 0);

            var totalGeneral =
                totalEfectivo +
                totalTransferencia +
                totalPropinas;

            ViewBag.totalVehiculos = totalVehiculos;
            ViewBag.totalEfectivo = totalEfectivo;
            ViewBag.TotalTransferencia = totalTransferencia;
            ViewBag.totalPropinas = totalPropinas;
            ViewBag.totalGeneral = totalGeneral;

            return View(ingresos);
        }

        // =================== vista Estado Turno ===================== //

        public IActionResult Estado_Turnos(DateTime? FechaSeleccionada) {

            // Muestra dinero de todos los turnos: solo el administrador
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return RedirectToAction("Index");
            }

            var model = new EstadoTurnosViewModel();

            DateTime FechaConsulta;

            if (FechaSeleccionada.HasValue)
            {
                FechaConsulta = FechaSeleccionada.Value.Date;
            }
            else
            {
                FechaConsulta = DateTime.Today;
            }

            model.FechaHoy = FechaConsulta;

            model.Valets = (
                from s in _context.sesiones
                join u in _context.usuarios
                    on s.id_usuario equals u.id_usuario

                where s.id_rol == 1 &&
                        s.fecha_inicio.Date == FechaConsulta &&
                        s.fecha_fin == null

                group new { s, u } by s.id_usuario into grupo

                select new ValetActivoVM
                {
                    IdUsuario = grupo.Key,
                    Nombres = grupo.First().u.nombres ?? "",
                    Apellidos = grupo.First().u.apellidos ?? "",


                    // Consultamos lo que debe el valet al banco
                    // (por fecha de entrega, igual que la regla de liquidación)
                    Deuda = _context.ingresos
                            .Where(i => i.rol_cobrador == "valet" &&
                                        i.usuario_cobro == grupo.Key &&
                                        i.metodo_pago == "Efectivo" &&
                                        i.estado_pago == "pagado" &&
                                        i.fecha_entrega.HasValue &&
                                        i.fecha_entrega.Value.Date == FechaConsulta &&
                                        i.estado_liquidacion == false)
                            .Sum(i => (decimal?)i.valor_servicio) ?? 0,

                    // Consultamos los vehiculos recibidos por ese valet
                    VehiculosRecibidos = _context.ingresos
                            .Count(i => i.id_valet == grupo.Key &&
                                        i.fecha_ingreso.HasValue &&
                                        i.fecha_ingreso.Value.Date == FechaConsulta),

                    // Consultamos los vehiculos despachados por ese valet
                    VehiculosDespachados = _context.ingresos
                            .Count(i => i.valet_despacho == grupo.Key &&
                                        i.fecha_ingreso.HasValue &&
                                        i.fecha_ingreso.Value.Date == FechaConsulta)
                }

            ).ToList();

            model.Bancos = (
                from s in _context.sesiones
                join u in _context.usuarios
                    on s.id_usuario equals u.id_usuario

                where s.id_rol == 2 &&
                        s.fecha_inicio.Date == FechaConsulta &&
                        s.fecha_fin == null

                group new { s, u } by s.id_usuario into grupo

                select new BancoActivoVM
                {
                    IdUsuario = grupo.Key,

                    Nombres = grupo.First().u.nombres ?? "",
                    Apellidos = grupo.First().u.apellidos ?? "",

                    LugarActual = grupo.First().s.Ubicacion.nombre_ubicacion ?? "Sin Ubicacion",

                    VehiculosUbicacion = _context.ingresos.Count(i =>
                        i.id_ubicacion == grupo.First().s.id_ubicacion &&
                        i.estado_servicio != "despachado" &&
                        i.estado_servicio != "finalizado" &&
                        i.fecha_ingreso.HasValue &&
                        i.fecha_ingreso.Value.Date == FechaConsulta),

                    Liquidado = grupo.First().s.estado_liquidacion
                }

            ).ToList();

            model.Keys = (
                from s in _context.sesiones
                join u in _context.usuarios
                    on s.id_usuario equals u.id_usuario

                where s.id_rol == 4 &&
                        s.fecha_inicio.Date == FechaConsulta &&
                        s.fecha_fin == null

                group new { s , u } by s.id_usuario into grupo

                select new KeyActivoVM
                {
                    IdUsuario = grupo.Key,

                    Nombres = grupo.First().u.nombres ?? "",
                    Apellidos = grupo.First().u.apellidos ?? "",

                    Parqueadero = grupo.First().s.Parqueadero.nombre_parqueadero ?? "Sin Parqueadero",

                    CarrosEstacionados = _context.ingresos.Count(i =>
                        i.id_parqueadero == grupo.First().s.id_parqueadero &&
                        i.estado_servicio != "despachado" &&
                        i.estado_servicio != "finalizado")
                }

            ).ToList();

            // Liquidaciones del día, desde tbl_liquidacion (aunque el banco ya haya cerrado sesión)
            var inicioDia = FechaConsulta;
            var finDia = FechaConsulta.AddDays(1);

            model.Liquidaciones = _context.liquidaciones
                .AsNoTracking()
                .Where(l => l.fecha >= inicioDia && l.fecha < finDia)
                .OrderBy(l => l.fecha)
                .Select(l => new LiquidacionDiaVM
                {
                    IdLiquidacion = l.id_liquidacion,
                    Fecha = l.fecha,
                    Usuario = l.Usuario != null ? l.Usuario.nombres + " " + l.Usuario.apellidos : "—",
                    TotalVehiculos = l.total_vehiculos ?? 0,
                    TotalEfectivo = l.total_efectivo ?? 0,
                    TotalTransferencias = l.total_transferencias ?? 0,
                    TotalLiquidado = l.total_liquidado ?? 0
                })
                .ToList();

            return View(model);

        }

        // Vehículos que forman una liquidación (botón "Ver detalle" de Estado Turnos)
        [HttpGet]
        public IActionResult DetalleLiquidacion(int id)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return Json(new { success = false, message = "No tienes permiso para ver liquidaciones." });
            }

            var vehiculos = (
                from i in _context.ingresos.AsNoTracking()
                where i.id_liquidacion == id
                join u in _context.usuarios on i.usuario_cobro equals (int?)u.id_usuario into cobradores
                from u in cobradores.DefaultIfEmpty()
                orderby i.fecha_entrega
                select new
                {
                    placa = i.placa,
                    entrega = i.fecha_entrega,
                    cobro = u != null ? u.nombres + " " + u.apellidos : "—",
                    rol = i.rol_cobrador,
                    metodo = i.metodo_pago,
                    valor = i.valor_servicio ?? 0,
                    ubicacion = i.Ubicacion != null ? i.Ubicacion.nombre_ubicacion : "—"
                }
            )
            .ToList()
            .Select(v => new
            {
                v.placa,
                entrega = v.entrega?.ToString("dd/MM HH:mm") ?? "—",
                v.cobro,
                v.rol,
                v.metodo,
                v.valor,
                v.ubicacion
            });

            return Json(new { success = true, vehiculos });
        }


        // =================== vista key =================== //

        // GET: /Home/VistaKey
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult VistaKey(string placa, string estado_servicio)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");
            var idParqueaderoSesion = HttpContext.Session.GetInt32("id_parqueadero_sesion");

            System.Diagnostics.Debug.WriteLine($"=== VistaKey GET ===");
            System.Diagnostics.Debug.WriteLine($"idUsuarioSesion: {idUsuarioSesion}");
            System.Diagnostics.Debug.WriteLine($"rolUsuario: {rolUsuario}");

            if (!idUsuarioSesion.HasValue ||
                (rolUsuario != 4 && rolUsuario != 1 && rolUsuario != 3))
            {
                System.Diagnostics.Debug.WriteLine($"Acceso denegado: no es rol Key");
                return RedirectToAction("Login", "Auth");
            }

            var sesion = _context.sesiones
                .FirstOrDefault(s =>
                    s.id_usuario == idUsuarioSesion &&
                    s.fecha_fin == null
                );

            // Solo el Key necesita su turno (de ahí sale su parqueadero); valet y admin lo eligen en el modal.
            // Se limpia la sesión web para que el login no lo devuelva aquí en bucle.
            if (sesion == null && rolUsuario == 4)
            {
                System.Diagnostics.Debug.WriteLine($"ERROR: No hay sesión activa para el usuario {idUsuarioSesion}");
                HttpContext.Session.Clear();
                return RedirectToAction("Login", "Auth");
            }

            List<ingresos> ingresos;

            if (rolUsuario == 1 || rolUsuario == 3)
            {
                if (!idParqueaderoSesion.HasValue)
                {
                    ViewBag.MostrarModal = true;
                    ingresos = new List<ingresos>();
                }
                else
                {
                    ingresos = IngresosVistaKey(idParqueaderoSesion, placa, estado_servicio);

                    ViewBag.MostrarModal = false;
                }
            }
            else
            {
                ingresos = IngresosVistaKey(sesion!.id_parqueadero, placa, estado_servicio);

                ViewBag.MostrarModal = false;
            }

            var idParqueaderoVista = idParqueaderoSesion ?? sesion?.id_parqueadero;
            var parqueadero = _context.parqueaderos.FirstOrDefault(p => p.id_parqueadero == idParqueaderoVista);

            // La información del vehículo (fotos, videos, firma) se pide al abrir el modal, igual que en la tabla de ingresos

            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroEstado"] = estado_servicio;
            ViewData["NombreParqueadero"] = parqueadero?.nombre_parqueadero ?? "Parqueadero";
            ViewBag.valets = ValetsDisponibles();
            ViewBag.idRol = rolUsuario;
            ViewBag.EstaEnParqueadero = idParqueaderoSesion.HasValue;
            ViewBag.Parqueaderos = _context.parqueaderos
                .OrderBy(p => p.nombre_parqueadero)
                .ToList();

            return View(ingresos);
        }

        // Vehículos de un parqueadero que muestra VistaKey, con los filtros de la página.
        // Los usan la página y su refresco (FilasVistaKey), para que las dos muestren lo mismo.
        private List<ingresos> IngresosVistaKey(int? idParqueadero, string? placa, string? estado_servicio)
        {
            var query = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Where(i =>
                    i.id_parqueadero == idParqueadero &&
                    i.estado_servicio != "finalizado" &&
                    i.estado_servicio != "despachado" &&
                    i.estado_pago != "pagado");

            if (!string.IsNullOrWhiteSpace(placa))
            {
                var placaFiltro = placa.Trim().ToUpper();
                query = query.Where(i => i.placa != null && i.placa.Contains(placaFiltro));
            }

            if (!string.IsNullOrEmpty(estado_servicio))
            {
                query = query.Where(i => i.estado_servicio == estado_servicio);
            }

            // Primero los solicitados; luego los más recientes
            return query
                .AsEnumerable()
                .OrderByDescending(i => i.estado_servicio?.Trim().ToLower() == "solicitado")
                .ThenByDescending(i => i.fecha_ingreso)
                .ToList();
        }

        // POST: Cambiar el estado desde la vista Key, o Parquear desde el modal de Información de la
        // tabla de ingresos (volver = "tabla", puntos 13 y 18)
        [HttpPost]
        public IActionResult ActualizarEstadoKey(int id_ingreso, string nuevo_estado, int? id_valet = null, string? volver = null)
        {
            // La sesión ya la revisa OnActionExecuting para todo HomeController
            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            // Desde la tabla de ingresos se vuelve a la tabla con su alerta verde o roja; si no, a VistaKey
            IActionResult Volver(string mensaje)
            {
                if (volver == "tabla")
                {
                    TempData[mensaje.StartsWith("Error") ? "Error" : "Exito"] = mensaje;
                    return RedirectToAction("Tabla_Vehiculos");
                }

                TempData["DebugVistaKey"] = mensaje;
                return RedirectToAction("VistaKey");
            }

            // La regla se valida aquí porque el botón Parquear puede seguir en pantalla (refresco o página sin recargar)
            if (ingreso != null && nuevo_estado == "parqueado" && !IngresoReglas.PuedeParquear(ingreso))
            {
                return Volver(ingreso.id_valet == null
                    ? "Error al parquear: el vehículo no tiene valet asignado."
                    : $"Error al parquear: el vehículo está {ingreso.estado_servicio ?? "sin estado"}.");
            }

            // Despachar desde VistaKey: solo parqueado o solicitado y con un valet de despacho válido
            // (el cobro lo exige, punto 32). Antes no se revisaba y se podía despachar en cualquier estado
            if (ingreso != null && nuevo_estado == "despachado" &&
                (!IngresoReglas.PuedeDespachar(ingreso) || !id_valet.HasValue || !ValetsDisponibles().Any(v => v.id_usuario == id_valet)))
            {
                return Volver(!IngresoReglas.PuedeDespachar(ingreso)
                    ? $"Error al despachar: el vehículo está {ingreso.estado_servicio ?? "sin estado"}."
                    : "Error al despachar: elige un valet de despacho de la lista.");
            }

            string mensaje;

            if (ingreso != null)
            {
                ingreso.estado_servicio = nuevo_estado;

                // Si llegó un id_valet (p. ej. desde el modal de despacho) lo guardamos en valet_despacho
                if (id_valet.HasValue)
                {
                    ingreso.valet_despacho = id_valet.Value;
                }
                else
                {
                    // Si NO llegó valet y la acción es marcar "parqueado", dejamos id_valet nulo (según requisito)
                    if (nuevo_estado == "parqueado")
                    {
                        ingreso.valet_despacho = null;
                    }
                    // en otros casos no modificamos id_valet para no sobreescribir datos previos
                }

                // Quién lo parqueó y a qué hora: el Key desde VistaKey o un operador desde Información
                if (nuevo_estado == "parqueado")
                {
                    ingreso.usuario_parqueo = HttpContext.Session.GetInt32("id");
                    ingreso.fecha_parqueo = DateTime.Now;
                }

                if (nuevo_estado == "despachado")
                {
                    ingreso.fecha_salida = DateTime.Now;
                }

                _context.SaveChanges();

                mensaje = nuevo_estado switch
                {
                    "parqueado" when ingreso.estado_servicio == "parqueado" => "Parqueado con éxito.",
                    "parqueado" => "Error al parquear.",
                    "despachado" when ingreso.estado_servicio == "despachado" => "Despachado con éxito.",
                    "despachado" => "Error al despachar.",
                    _ => "Estado actualizado."
                };
            }
            else
            {
                mensaje = nuevo_estado == "parqueado"
                    ? "Error al parquear."
                    : nuevo_estado == "despachado"
                        ? "Error al despachar."
                        : "No se encontró el ingreso.";
            }

            // Lo retornamos a la vista (VistaKey o la tabla de ingresos)
            return Volver(mensaje);
        }

        // Despachar desde la burbuja de solicitados (puntos 25 y 33): banco, admin y valet. Quien despacha queda
        // como valet de despacho (en VistaKey, en cambio, se elige de la lista). Responde JSON para no recargar
        // la página: la burbuja también está en el ingreso de vehículos y no se debe perder lo escrito
        [HttpPost]
        public IActionResult DespacharDesdeBurbuja(int id_ingreso)
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuario.HasValue || rolUsuario is not (1 or 2 or 3))
            {
                return Json(new { success = false, mensaje = "No tienes permiso para despachar desde aquí." });
            }

            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (!IngresoReglas.PuedeDespachar(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} está {ingreso.estado_servicio ?? "sin estado"} y no se puede despachar." });
            }

            ingreso.estado_servicio = "despachado";
            ingreso.valet_despacho = idUsuario.Value;
            ingreso.fecha_salida = DateTime.Now;
            _context.SaveChanges();

            return Json(new { success = true, mensaje = $"Vehículo {ingreso.placa} despachado. Quedaste como valet de despacho." });
        }

        // Metodo para guardar parqueadero del valet
        [HttpPost]
        public IActionResult GuardarParqueaderoSesion(
            [FromBody] ParqueaderoDTO data)
        {
            HttpContext.Session.SetInt32(
                "id_parqueadero_sesion",
                data.idParqueadero
            );

            return Json(new { success = true });
        }

                // El admin cambia de parqueadero desde el menú de la vista Key
        [HttpPost]
        public IActionResult CambiarParqueaderoAdmin(int id_parqueadero)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return Forbid();
            }

            bool existe = _context.parqueaderos
                .Any(p => p.id_parqueadero == id_parqueadero && p.estado == "activo");

            if (existe)
            {
                HttpContext.Session.SetInt32("id_parqueadero_sesion", id_parqueadero);
            }

            return RedirectToAction("VistaKey");
        }


        // Metodo para obtener las solicitudes de ingresos de vehiculos en estado "solicitado" para el valet y banco
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerSolicitudes()
        {
            // Obtenemos usuario y rol de la sesión
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Iniciamos consulta base
            var query = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Where(i =>
                    i.estado_servicio != null &&
                    i.estado_servicio.Trim().ToLower() == "solicitado"
                )
                .AsQueryable();

            // Filtramos según el rol
            if (rolUsuario == 2 && idUsuario.HasValue)
            {
                // Buscar sesión activa del usuario banco
                var sesionBanco = _context.sesiones
                    .FirstOrDefault(s =>
                        s.id_usuario == idUsuario.Value &&
                        s.fecha_fin == null
                    );

                // Filtrar por ubicación de la sesión
                if (sesionBanco != null)
                {
                    query = query.Where(i =>
                        i.id_ubicacion == sesionBanco.id_ubicacion
                    );
                }
            }

            // Convertimos los datos en un objeto más limpio
            var solicitudes = query
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,
                    estado_servicio = i.estado_servicio,

                    id_valet = i.id_valet,
                    id_banco = i.id_banco,

                    nombre_valet = i.Valet != null
                        ? i.Valet.nombres
                        : "Sin valet",

                    nombre_banco = i.Banco != null
                        ? i.Banco.nombres
                        : "Sin banco",

                    // Para verlo al tocar el vehículo en la burbuja (punto 25)
                    lugar_entrega = i.lugar_entrega
                })
                .ToList();

            // Contamos solicitudes
            var cantidad = solicitudes.Count();

            // Retornamos JSON
            return Json(new
            {
                cantidad = cantidad,
                solicitudes = solicitudes,
                serverTime = DateTime.Now.ToString("O")
            });
        }

        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerDespachados()
        {
            // Obtenemos usuario y rol
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Consulta base
            var query = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Where(i =>
                    i.estado_servicio != null &&
                    i.estado_servicio.Trim().ToLower() == "despachado"
                )
                .AsQueryable();

            // Filtrado por rol
            if (idUsuario.HasValue)
            {
                // Valet: ve todos los despachados, sin filtro

                // Banco
                if (rolUsuario == 2)
                {
                    query = query.Where(i => i.id_banco == idUsuario.Value);
                }

                // Otros roles
                else if (rolUsuario != 3 && rolUsuario != 1)
                {
                    query = query.Where(i =>
                        i.id_valet == idUsuario.Value ||
                        i.id_banco == idUsuario.Value
                    );
                }
            }

            // Convertimos datos
            var despachados = query
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,

                    nombre_valet = i.Valet != null
                        ? i.Valet.nombres
                        : "Sin valet",

                    nombre_banco = i.Banco != null
                        ? i.Banco.nombres
                        : "Sin banco"
                })
                .ToList();

            return Json(new
            {
                cantidad = despachados.Count(),
                vehiculos = despachados
            });
        }

        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerEsperandoValet()
        {

            // Obtenemos usuario y rol
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Consulta base
            var query = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Where(i =>
                    i.estado_servicio != null &&
                    i.estado_servicio.Trim().ToLower() == "esperando valet"
                )
                .AsQueryable();

            // Convertimos datos
            var esperandoValet = query
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,

                    nombre_valet = i.Valet != null
                        ? i.Valet.nombres
                        : "Sin valet",

                    nombre_banco = i.Banco != null
                        ? i.Banco.nombres
                        : "Sin banco"
                })
                .ToList();

            return Json(new
            {
                cantidad = esperandoValet.Count(),
                vehiculos = esperandoValet
            });

        }

        // Metodo para tomar la solicitud de un vehiculo
        // Cambiamos el estado de solicitado a en curso
        [HttpPost]
        public IActionResult TomarSolicitud(int idIngreso) {

            // Buscar el ingreso por ID
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == idIngreso);

            // Validar que exista
            if (ingreso == null)
            {
                return NotFound(new
                {
                    mensaje = "Ingreso no encontrado"
                });
            }

            // Cambiar estado
            ingreso.estado_servicio = "en curso";

            // Guardar cambios en BD
            _context.SaveChanges();

            // Respuesta exitosa
            return Ok(new
            {
                mensaje = "Solicitud tomada correctamente"
            });

        } 

        public IActionResult Administrador(string? nombre, string? apellido, string? documento, int? edad, int? rol, string? estado)
        {
            var parametros = new[] {
                new SqlParameter("@nombre", nombre ?? (object) DBNull.Value),
                new SqlParameter("@apellido", apellido ?? (object) DBNull.Value),
                new SqlParameter("@documento", documento ?? (object) DBNull.Value),
                new SqlParameter("@edad", edad ?? (object) DBNull.Value),
                new SqlParameter("@rol", rol ?? (object) DBNull.Value),
                new SqlParameter("@estado", estado ?? (object) DBNull.Value)
            };

            ViewBag.Usuarios = _context.usuarios.FromSqlRaw("EXEC sp_consultarUsuarios @nombre, @apellido, @documento, @edad, @rol, @estado", parametros)
                .AsEnumerable()
                .OrderByDescending(u => u.estado)
                .ThenBy(u => u.nombres)
                .ToList();

            // Consultamos todos los usuarios del sistema, dejando los activos arriba y los inactivos al final
            /*ViewBag.Usuarios = _context.usuarios
                .OrderByDescending(u => u.estado)
                .ThenBy(u => u.nombres)
                .ToList();*/

            // Consultamos todas las ubicaciones del sistema, dejando los activos arriba y los inactivos al final
            ViewBag.Ubicaciones = _context.ubicacion_servicios
                .OrderByDescending(u => u.estado)
                .ThenBy(u => u.nombre_ubicacion)
                .ToList();

            // Consultamos todos los parqueaderos del sistema, dejando los activos arriba y los inactivos al final
            ViewBag.Parqueaderos = _context.parqueaderos
                .OrderByDescending(p => p.estado)
                .ThenBy(p => p.nombre_parqueadero)
                .ToList();

            // Detectar si hay filtros activos de usuarios
            bool tieneFiltrosUsuarios = !string.IsNullOrEmpty(nombre) || !string.IsNullOrEmpty(apellido) ||
                                       !string.IsNullOrEmpty(documento) || edad.HasValue || rol.HasValue ||
                                       !string.IsNullOrEmpty(estado);

            ViewData["FiltroNombre"] = nombre;
            ViewData["FiltroApellido"] = apellido;
            ViewData["FiltroIdentificacion"] = documento;
            ViewData["FiltroEdad"] = edad;
            ViewData["FiltroRol"] = rol;
            ViewData["FiltroEstadoUsuario"] = estado;
            ViewData["TieneFiltrosUsuarios"] = tieneFiltrosUsuarios;

            return View();
        }

        public IActionResult Tabla_Vehiculos(string placa, string? lugar, string estado_servicio, string estado_pago, string? parqueadero, DateTime? fechaInicio, DateTime? fechaFin)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");

            ViewBag.mostrarMenu = false;

            if (!idUsuarioSesion.HasValue)
            {
                return RedirectToAction("Login", "Auth");
            }

            int idUsuario = idUsuarioSesion.Value;

            var ubicacionUsuario = (from s in _context.sesiones
                                    join u in _context.ubicacion_servicios
                                    on s.id_ubicacion equals u.id_ubicacion
                                    where s.id_usuario == idUsuario
                                          && s.fecha_fin == null
                                    select u.nombre_ubicacion)
           .FirstOrDefault();

            ViewBag.ubicacion = ubicacionUsuario;

            var ingresos = IngresosTabla(idUsuario, placa, lugar, estado_servicio, estado_pago, parqueadero, fechaInicio, fechaFin);
            ViewBag.NombresSolicitud = NombresSolicitud(ingresos);
            ViewBag.ValoresUbicacion = ValoresUbicacion();
            int totalRegistros = ingresos.Count();

            ViewBag.TotalRegistros = totalRegistros;

            // Listas de los filtros en orden alfabético (punto 15)
            ViewBag.Ubicaciones = _context.ubicacion_servicios.OrderBy(u => u.nombre_ubicacion).ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.OrderBy(p => p.nombre_parqueadero).ToList();
            ViewBag.Valets = ValetsDisponibles();


            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroLugar"] = lugar;
            ViewData["FiltroEstadoServicio"] = estado_servicio;
            ViewData["FiltroEstadoPago"] = estado_pago;
            ViewData["FiltroParqueadero"] = parqueadero;
            ViewData["FiltroFechaInicio"] = fechaInicio;
            ViewData["FiltroFechaFin"] = fechaFin;

            return View(ingresos);
        }

        // Ingresos de la tabla según los filtros y el rol (procedimiento sp_consultarRegistros). Los usan
        // la página y su refresco automático (FilasIngresos, punto 16) para mostrar exactamente lo mismo
        private List<ingresos> IngresosTabla(int idUsuario, string? placa, string? lugar, string? estado_servicio,
            string? estado_pago, string? parqueadero, DateTime? fechaInicio, DateTime? fechaFin)
        {
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            var idUbicacionUsuario = (from s in _context.sesiones
                                      where s.id_usuario == idUsuario
                                      && s.fecha_fin == null
                                      select s.id_ubicacion)
                                      .FirstOrDefault();

            // Convertir placa a mayúsculas
            string? placaUpper = !string.IsNullOrEmpty(placa) ? placa.Trim().ToUpper() : null;
            string? nombreUbicacion = !string.IsNullOrEmpty(lugar) ? lugar : null;
            string? estadoServicio = !string.IsNullOrEmpty(estado_servicio) ? estado_servicio : null;
            string? estadoPago = !string.IsNullOrEmpty(estado_pago) ? estado_pago : null;
            string? nombreParqueadero = !string.IsNullOrEmpty(parqueadero) ? parqueadero : null;


            var parametros = new List<SqlParameter>
{
                new SqlParameter("@placa", placaUpper ?? (object)DBNull.Value),
                new SqlParameter("@lugar", nombreUbicacion ?? (object)DBNull.Value),
                new SqlParameter("@estado_servicio", estadoServicio ?? (object)DBNull.Value),
                new SqlParameter("@estado_pago", estadoPago ?? (object)DBNull.Value),
                new SqlParameter("@parqueadero", nombreParqueadero ?? (object)DBNull.Value),
                new SqlParameter("@fecha_inicio", fechaInicio.HasValue ? (object)fechaInicio.Value.Date : DBNull.Value),
                new SqlParameter("@fecha_fin", fechaFin.HasValue ? (object)fechaFin.Value.Date : DBNull.Value)
            };

            // 🔥 lógica de rol

            int? idUbicacionFiltro = null;
            object idUsuarioParam = DBNull.Value;

            // Condicion cuando sea banco
            if (rolUsuario == 2)
            {

                idUbicacionFiltro = idUbicacionUsuario;

            }

            // Condicion cuando no sea admin ni valet (el valet ve todos los ingresos)
            if (rolUsuario != 3 && rolUsuario != 1)
            {

                idUsuarioParam = idUsuario;

            }

            parametros.Add(new SqlParameter("@id_usuario", idUsuarioParam));
            parametros.Add(new SqlParameter("@id_ubicacion", idUbicacionFiltro ?? (object)DBNull.Value));
            
            // ✔ conversión a array (ESTO ES LO CLAVE)
            return _context.ingresos.FromSqlRaw(
                "EXEC sp_consultarRegistros @placa, @lugar, @estado_servicio, @estado_pago, @id_usuario, @parqueadero, @fecha_inicio, @fecha_fin, @id_ubicacion", 
                parametros.ToArray()
            )
            .AsEnumerable()
            .OrderByDescending(u => u.estado_servicio?.Trim().ToLower() == "solicitado")
            .ThenByDescending(u => u.fecha_ingreso)
            .ToList();
        }

        // Filas de la tabla de ingresos para el refresco automático (punto 16): las mismas de la página,
        // con sus filtros, armadas por la misma vista parcial (_FilasIngresos)
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult FilasIngresos(string? placa, string? lugar, string? estado_servicio, string? estado_pago, string? parqueadero, DateTime? fechaInicio, DateTime? fechaFin)
        {
            // Sin sesión, OnActionExecuting ya redirige al login
            var idUsuario = HttpContext.Session.GetInt32("id");
            if (!idUsuario.HasValue)
            {
                return Unauthorized();
            }

            var ingresos = IngresosTabla(idUsuario.Value, placa, lugar, estado_servicio, estado_pago, parqueadero, fechaInicio, fechaFin);
            ViewBag.NombresSolicitud = NombresSolicitud(ingresos);
            ViewBag.ValoresUbicacion = ValoresUbicacion();

            return PartialView("_FilasIngresos", ingresos);
        }

        // Valor del servicio de cada ubicación: el título del modal de cobrar en la tabla de ingresos
        private Dictionary<int, decimal> ValoresUbicacion() =>
            _context.ubicacion_servicios.AsNoTracking().ToDictionary(u => u.id_ubicacion, u => u.valor_servicio);

        // Nombre de quien solicitó cada vehículo de la tabla (columna Solicitud, punto 26)
        private Dictionary<int, string> NombresSolicitud(List<ingresos> ingresos)
        {
            var ids = ingresos
                .Where(i => i.usuario_solicitud.HasValue)
                .Select(i => i.usuario_solicitud!.Value)
                .Distinct()
                .ToList();

            return _context.usuarios
                .Where(u => ids.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);
        }
        [HttpPost]
        public IActionResult actualizarValet(int id_ingreso, int id_valet)
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                TempData["Error"] = "No se encontró el vehículo.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            // El valet solo se toma el vehículo a sí mismo; banco y admin asignan a un valet de la lista
            bool permitido = rolUsuario == 1
                ? id_valet == idUsuario
                : (rolUsuario == 2 || rolUsuario == 3) && ValetsDisponibles().Any(v => v.id_usuario == id_valet);

            if (!permitido)
            {
                TempData["Error"] = "No puedes asignar ese valet.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            // Solo se asigna a un vehículo sin valet que todavía no ha salido
            if (!IngresoReglas.PuedeRecibirValet(ingreso))
            {
                TempData["Error"] = $"El vehículo {ingreso.placa} ya tiene valet o no se le puede asignar uno.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            ingreso.id_valet = id_valet;

            // El que esperaba valet pasa a activo; un solicitado sigue solicitado (no se pierde la solicitud)
            if (ingreso.estado_servicio?.Trim().ToLower() == "esperando valet")
            {
                ingreso.estado_servicio = "activo";
            }

            _context.SaveChanges();

            TempData["Exito"] = $"Valet asignado al vehículo {ingreso.placa}.";
            return RedirectToAction("Tabla_Vehiculos");
        }

        // Valets que se pueden asignar a un vehículo: los de rol Valet, quien tenga turno abierto como
        // valet (switch de rol) y el admin, que también trabaja como valet. Ordenados por nombre.
        private List<usuarios> ValetsDisponibles()
        {
            var enTurnoDeValet = _context.sesiones
                .Where(s => s.fecha_fin == null && s.id_rol == 1)
                .Select(s => s.id_usuario);

            return _context.usuarios
                .Where(u => u.estado &&
                            (u.id_rol == 1 || u.id_rol == 3 || enTurnoDeValet.Contains(u.id_usuario)))
                .OrderBy(u => u.nombres)
                .ThenBy(u => u.apellidos)
                .ToList();
        }
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Ingreso_Vehiculos()
        {
            ViewBag.mostrarMenu = false;

            CargarDatosFormulario();
            return View();
        }

        public IActionResult Pago()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        //Evento para ingresar a un nuevo vehiculo

        // Este atributo indica que este método responde a peticiones HTTP POST
        // Es decir, cuando el formulario de registro se envía (method="post")
        [HttpPost]
        public async Task<IActionResult> IngresoVehiculos(ingresos obj_ingreso, int? id_valet, int id_banco, string? firmaBase64, bool sin_objetos_valor = false, List<string>? fotos = null, string? videoBase64 = null)
        {
            // DEBUG TEMPORAL
            System.Diagnostics.Debug.WriteLine("=== ENTRÓ AL POST ===");
            System.Diagnostics.Debug.WriteLine($"placa: {obj_ingreso?.placa}");
            System.Diagnostics.Debug.WriteLine($"nombre_cliente: {obj_ingreso?.nombre_cliente}");
            System.Diagnostics.Debug.WriteLine($"id_valet: {id_valet}");
            System.Diagnostics.Debug.WriteLine($"id_banco: {id_banco}");
            System.Diagnostics.Debug.WriteLine($"ModelState válido: {ModelState.IsValid}");

            if (!ModelState.IsValid)
            {
                TempData["Error"] = "Por favor, completa correctamente todos los campos obligatorios.";
            }

            CargarDatosFormulario();

            // Validar que el modelo no sea nulo en caso de interrupción en la subida del formulario
            if (obj_ingreso == null)
            {
                ViewBag.Error = "Error al recibir los datos del formulario. Es posible que la conexión se haya interrumpido o las imágenes sean demasiado pesadas. Por favor, intenta de nuevo.";
                return View("Ingreso_Vehiculos");
            }

            // Validar que se haya seleccionado un valet
            /*if (id_valet <= 0)
            {
                ViewBag.Error = "Debe seleccionar un valet para el ingreso del vehículo.";
                return View("Ingreso_Vehiculos");
            }*/

            // Validar que se haya seleccionado un banco
            if (id_banco <= 0)
            {
                ViewBag.Error = "Debe seleccionar un banco para el ingreso del vehículo.";
                return View("Ingreso_Vehiculos");
            }

            // **DEBUG: Verificar si llega la firma**
            System.Diagnostics.Debug.WriteLine($"=== DEBUG FIRMA ===");
            System.Diagnostics.Debug.WriteLine($"firmaBase64 es null: {firmaBase64 == null}");
            System.Diagnostics.Debug.WriteLine($"firmaBase64 está vacío: {string.IsNullOrEmpty(firmaBase64)}");
            System.Diagnostics.Debug.WriteLine($"Longitud firmaBase64: {firmaBase64?.Length ?? 0}");
            if (!string.IsNullOrEmpty(firmaBase64))
            {
                System.Diagnostics.Debug.WriteLine($"Primeros 50 caracteres: {firmaBase64.Substring(0, Math.Min(50, firmaBase64.Length))}");
            }

            //primero validamos el modelo del vehiculo y que todos los campos sean validos
            foreach (var state in ModelState)
            {
                foreach (var error in state.Value.Errors)
                {
                    System.Diagnostics.Debug.WriteLine($"Campo: {state.Key} | Error: {error.ErrorMessage}");
                }
            }

            // Normalizar la placa (Mayusculas y sin espacios) y usarla para la comparación
            string placaNormalized = obj_ingreso.placa?.Trim().ToUpper() ?? ""; obj_ingreso.placa = placaNormalized;

            System.Diagnostics.Debug.WriteLine($"Normalized placa for comparison: '{placaNormalized}'");

            if (String.IsNullOrWhiteSpace(placaNormalized))
            {
                ViewBag.Error = "La placa del vehiculo es obligatoria";
                return View("Ingreso_Vehiculos");
            }

            try
            {

                // Buscar si existe un ingreso con la misma placa — hacemos la comparación normalizando también la columna de la BD
                var ingresoActivo = _context.ingresos
                    .Where(i => i.placa != null && i.placa.Trim().ToUpper() == placaNormalized)
                    .OrderByDescending(i => i.fecha_ingreso)
                    .FirstOrDefault();

                bool enviarWhatsapp = true;
                // ==============================
                // OBTENER DATOS DE UBICACIÓN/PARQUEADERO DESDE SESIÓN
                // ==============================
                var idUsuarioSesion = HttpContext.Session.GetInt32("id");

                // Buscar sesión activa del usuario
                var sesionUsuario = _context.sesiones
                    .FirstOrDefault(s =>
                        s.id_usuario == idUsuarioSesion &&
                        s.fecha_fin == null
                    );

                // Si hay parqueadero en sesión activa, usarlo en el ingreso
                if (sesionUsuario != null && sesionUsuario.id_parqueadero.HasValue)
                {
                    System.Diagnostics.Debug.WriteLine($"Asignando parqueadero de sesión: {sesionUsuario.id_parqueadero}");
                    obj_ingreso.id_parqueadero = sesionUsuario.id_parqueadero.Value;
                }

                // Ubicación: viene del formulario para todos (campo obligatorio)
                bool ubicacionValida = obj_ingreso.id_ubicacion > 0 &&
                    _context.ubicacion_servicios.Any(u => u.id_ubicacion == obj_ingreso.id_ubicacion && u.estado == "activo");

                if (!ubicacionValida)
                {
                    ViewBag.Error = "Selecciona una ubicación válida.";
                    CargarDatosFormulario();
                    return View("Ingreso_Vehiculos");
                }

                // Si es banco y eligió otra ubicación, su turno se moverá allá (después de guardar el ingreso)
                bool moverTurno = HttpContext.Session.GetInt32("id_rol") == 2 &&
                                  idUsuarioSesion.HasValue &&
                                  sesionUsuario?.id_ubicacion != obj_ingreso.id_ubicacion;


                // validar si el vehiculo ya esta en el parqueadero
                if (ingresoActivo != null)
                {
                    System.Diagnostics.Debug.WriteLine($"Found ingresoActivo id:{ingresoActivo.id_ingreso} placa:'{ingresoActivo.placa}' estado_servicio:'{ingresoActivo.estado_servicio}' estado_pago:'{ingresoActivo.estado_pago}'");

                    // caso 1: El vehiculo esta actualmente en servicio (no ha salido)
                    if (ingresoActivo.estado_servicio == "activo" || ingresoActivo.estado_servicio == "solicitado" || ingresoActivo.estado_servicio == "despachado" || ingresoActivo.estado_servicio == "parqueado")
                    {
                        enviarWhatsapp = false;

                        ViewBag.Error = $"El vehiculo con placa {placaNormalized} ya tiene un servicio activo";
                        return View("Ingreso_Vehiculos");
                    }

                    // caso 2: El vehiculo salio pero tiene un pago pendiente
                    if (ingresoActivo.estado_pago == "pendiente")
                    {
                        enviarWhatsapp = false;

                        ViewBag.Error = $"El vehiculo con placa {placaNormalized} tiene un pago pendiente. Debe cancelarse antes de un nuevo ingreso en este mismo.";
                        return View("Ingreso_Vehiculos");
                    }
                }

                // Configurar valores automáticos del ingreso
                obj_ingreso.fecha_ingreso = DateTime.Now;
                obj_ingreso.fecha_salida = null;
                obj_ingreso.fecha_fin_servicio = null;
                obj_ingreso.estado_pago = "pendiente";
                obj_ingreso.estado_liquidacion = false;
                if (id_valet == 0) {

                    obj_ingreso.id_valet = null;
                    obj_ingreso.estado_servicio = "esperando valet";

                }
                else
                {

                    obj_ingreso.estado_servicio = "activo";
                    obj_ingreso.id_valet = id_valet;

                }
                obj_ingreso.id_banco = id_banco;

                // Si la ubicación tiene un valor fijo inicial, pudieras ponerlo aquí (opcional)
                obj_ingreso.valor_servicio = 0;
                obj_ingreso.valor_propina = 0;
                obj_ingreso.total_servicio = 0;

                // Buscar ubicación usando el id asignado desde sesión
                var ubicacion = _context.ubicacion_servicios
                    .FirstOrDefault(u => u.id_ubicacion == obj_ingreso.id_ubicacion);

                if (ubicacion != null)
                {
                    obj_ingreso.lugar_entrega = ubicacion.nombre_ubicacion;
                }

                // Convertir la firma de base64 a byte[]
                // Verificamos que la firma no llegue vacia
                if (!string.IsNullOrEmpty(firmaBase64))
                {
                    try
                    {
                        //remover el prefijo "data:image/png;base64," si existe
                        var base64Data = firmaBase64.Contains(",")
                            ? firmaBase64.Split(',')[1]
                            : firmaBase64;

                        obj_ingreso.firma = Convert.FromBase64String(base64Data);
                        System.Diagnostics.Debug.WriteLine($"Firma convertida exitosamente. Tamaño: {obj_ingreso.firma.Length} bytes");
                    }
                    catch (Exception exFirma)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error al convertir firma: {exFirma.Message}");
                        ViewBag.Error = "Error al procesar la firma. Por favor, intenta nuevamente.";
                        return View("Ingreso_Vehiculos");
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("ADVERTENCIA: La firma está vacía o es null");
                    // Opcional: Puedes hacer que sea obligatoria
                    // ViewBag.Error = "La firma del cliente es obligatoria";
                    // return View("Ingreso_Vehiculos");
                }

                // Manejar el checkbox de sin objetos de valor
                // Verificamos ue llegue true o fue marcado
                if (sin_objetos_valor)
                {
                    // Verificamos si notas ya era vacia
                    obj_ingreso.notas = string.IsNullOrWhiteSpace(obj_ingreso.notas)
                        ? "Sin objetos de valor"
                        : obj_ingreso.notas;
                }

                // 6. GUARDAR INGRESO EN BD
                _context.ingresos.Add(obj_ingreso);
                int filasIngreso = await _context.SaveChangesAsync();

                if (filasIngreso <= 0)
                {
                    TempData["Error"] = "No se pudo registrar el ingreso en la base de datos.";
                    CargarDatosFormulario();
                    return View("Ingreso_Vehiculos", obj_ingreso);
                }

                // El ingreso ya quedó guardado: si el banco eligió otra ubicación, su turno pasa a esa ubicación
                if (moverTurno)
                {
                    SesionTurno.AbrirTurno(_context, HttpContext, idUsuarioSesion.Value, 2, obj_ingreso.id_ubicacion, null);
                }


                System.Diagnostics.Debug.WriteLine($"=== ANTES DE GUARDAR ===");
                System.Diagnostics.Debug.WriteLine($"Placa: {obj_ingreso.placa}");
                System.Diagnostics.Debug.WriteLine($"id_parqueadero: {obj_ingreso.id_parqueadero}");
                System.Diagnostics.Debug.WriteLine($"id_ubicacion: {obj_ingreso.id_ubicacion}");
                System.Diagnostics.Debug.WriteLine($"nombre_cliente: {obj_ingreso.nombre_cliente}");

                int filasAfectadas = _context.SaveChanges();

                System.Diagnostics.Debug.WriteLine($"=== FILAS AFECTADAS: {filasAfectadas} ===");

                // Llamamos metodo para mandar mansaje de Whatsapp
                try
                {

                    //buscamos el usuario valet 
                    var valet = _context.usuarios
                        .FirstOrDefault(i => i.id_usuario == obj_ingreso.id_valet);

                    String placa = placaNormalized;
                    String nombreCliente = valet?.nombres ?? "Cliente";
                    String telefonoCliente = obj_ingreso.telefono ?? string.Empty;

                    if (enviarWhatsapp)
                    {
                        var resultadoWhatsapp = await EnviarWhatsAppIngreso(placa, nombreCliente, obj_ingreso.id_ingreso, telefonoCliente, "ingreso");

                        if (resultadoWhatsapp.exito)
                        {
                            TempData["WhatsAppExito"] = resultadoWhatsapp.mensaje;
                        }
                        else
                        {
                            TempData["WhatsAppError"] = resultadoWhatsapp.mensaje;
                        }
                    }

                }
                catch (Exception ex)
                {

                    System.Diagnostics.Debug.WriteLine($"Error enviado Whatsapp: {ex.Message}");
                    TempData["WhatsAppError"] = "No se pudo enviar el WhatsApp al cliente.";

                }

                TempData["Exito"] = "¡Vehículo registrado exitosamente!";

                // Guardamos las fotos en la tabla imagenes
                if (fotos != null && fotos.Any())
                {
                    foreach (var fotoBase64 in fotos.Take(10))
                    {
                        if (!string.IsNullOrEmpty(fotoBase64))
                        {
                            var base64Data = fotoBase64.Contains(",")
                                ? fotoBase64.Split(',')[1]
                                : fotoBase64;

                            var imagen = new imagenes
                            {
                                id_ingreso = obj_ingreso.id_ingreso,
                                dato_imagen = Convert.FromBase64String(base64Data)
                            };
                            _context.imagenes.Add(imagen);
                        }
                    }
                    _context.SaveChanges();
                }


                // Guardar el video si existe
                if (!string.IsNullOrEmpty(videoBase64))
                {
                    var base64Data = videoBase64.Contains(",") ? videoBase64.Split(',')[1] : videoBase64;
                    var videoImagen = new imagenes
                    {
                        id_ingreso = obj_ingreso.id_ingreso,
                        dato_imagen = Convert.FromBase64String(base64Data)
                    };
                    _context.imagenes.Add(videoImagen);
                    _context.SaveChanges();
                }

                // Verificar rol del usuario    
                var rolUsuario = HttpContext.Session.GetInt32("id_rol");
                
                // Key (rol 4) va a VistaKey, todos los demás van a Tabla_Vehiculos
                if (rolUsuario == 4)
                {
                    return RedirectToAction("VistaKey");
                }

                return RedirectToAction("Tabla_Vehiculos");
            }
            catch (DbUpdateException ex)
            {
                System.Diagnostics.Debug.WriteLine($"DbUpdateException: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"Inner Exception: {ex.InnerException?.Message}");
                ViewBag.Error = "Error al registrar el vehiculo. verifica que todos los datos sean correctos.";
                TempData["Error"] = "Error al registrar el vehiculo. verifica que todos los datos sean correctos.: " + ex.Message;
                return View("Ingreso_Vehiculos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Exception: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"StackTrace: {ex.StackTrace}");
                ViewBag.Error = "Ocurrio un error inesperado. Por favor, intenta nuevamente.";
                TempData["Error"] = "Ocurrio un error inesperado. Por favor, intenta nuevamente.: " + ex.Message;
                return View("Ingreso_Vehiculos");
            }
        }

        // Metodo para enviar mensaje al whatsapp para solicitar vehiculo y pagar servicio
        // tipo: "ingreso" o "reenvio" (queda en el registro de WhatsApp enviados)
        private async Task<(bool exito, string mensaje)> EnviarWhatsAppIngreso(string placa, string nombre, int idIngreso, string telefono, string tipo)
        {
            if (string.IsNullOrWhiteSpace(telefono))
            {
                RegistrarWhatsApp(idIngreso, placa, telefono, tipo, false, null, null, "Número vacío");
                return (false, "No se pudo enviar WhatsApp: el número del cliente está vacío.");
            }

            // Datos de la API desde la configuración (el token va en secretos de usuario o variable de entorno)
            var token = _configuration["WhatsApp:Token"];
            var url = _configuration["WhatsApp:ApiUrl"];

            if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(url))
            {
                RegistrarWhatsApp(idIngreso, placa, telefono, tipo, false, null, null, "API de WhatsApp no configurada");
                return (false, "No se pudo enviar WhatsApp: la API de WhatsApp no está configurada.");
            }

            string baseUrl = _configuration["WhatsApp:LinkEstadoServicio"] ?? string.Empty;
            string linkPago = $"{baseUrl}{idIngreso}";

            var payload = new
            {
                messaging_product = "whatsapp",
                to = telefono,
                type = "template",
                template = new
                {
                    name = _configuration["WhatsApp:Plantilla"],
                    language = new { code = "en_US" },
                    components = new object[]
                    {
            // HEADER
                new
                {
                    type = "header",

                    parameters = new object[]
                    {
                        new
                        {
                            type = "image",

                            image = new
                            {
                                link = _configuration["WhatsApp:LogoUrl"]
                            }
                        }
                    }
                },

            // BODY
            new {
                type = "body",
                parameters = new object[]
                {
                    new { type = "text", text = placa },
                    new { type = "text", text = nombre },
                    new { type = "text", text = linkPago }
                }
            },

            new {
                type = "button",
                sub_type = "url",
                index = "0",
                parameters = new object[]
                {
                    new { type = "text", text = idIngreso.ToString() }
                }
            }
                    }
                }
            };

            using (var client = new HttpClient())
            {
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var json = System.Text.Json.JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                HttpResponseMessage response;
                string result;

                try
                {
                    response = await client.PostAsync(url, content);
                    result = await response.Content.ReadAsStringAsync();
                }
                catch (Exception ex)
                {
                    // Sin conexión con Meta: se registra y se responde sin romper la pantalla
                    System.Diagnostics.Debug.WriteLine($"Error de conexión WhatsApp: {ex.Message}");
                    RegistrarWhatsApp(idIngreso, placa, telefono, tipo, false, null, null, $"Sin conexión con Meta: {ex.Message}");
                    return (false, "No se pudo enviar WhatsApp: no hubo conexión con el servicio.");
                }

                System.Diagnostics.Debug.WriteLine($"=== WHATSAPP STATUS: {response.StatusCode} ===");
                System.Diagnostics.Debug.WriteLine($"=== WHATSAPP RESPONSE: {result} ===");

                if (!response.IsSuccessStatusCode)
                {
                    System.Diagnostics.Debug.WriteLine("? ERROR WHATSAPP:");
                    System.Diagnostics.Debug.WriteLine($"Status: {response.StatusCode}");
                    System.Diagnostics.Debug.WriteLine(result);
                    RegistrarWhatsApp(idIngreso, placa, telefono, tipo, false, (int)response.StatusCode, null, result);
                    return (false, $"No se pudo enviar WhatsApp. Estado: {(int)response.StatusCode} {response.StatusCode}.");
                }

                System.Diagnostics.Debug.WriteLine("? WhatsApp enviado correctamente");
                System.Diagnostics.Debug.WriteLine(result);
                System.Diagnostics.Debug.WriteLine($"WhatsApp response: {result}");

                // Id del mensaje en Meta (messages[0].id), útil para soporte
                string? idMensajeMeta = null;
                try
                {
                    using var respuestaJson = System.Text.Json.JsonDocument.Parse(result);
                    idMensajeMeta = respuestaJson.RootElement.GetProperty("messages")[0].GetProperty("id").GetString();
                }
                catch
                {
                    // Si Meta cambia el formato, el envío igual cuenta como exitoso
                }

                RegistrarWhatsApp(idIngreso, placa, telefono, tipo, true, (int)response.StatusCode, idMensajeMeta, null);
                return (true, "WhatsApp enviado correctamente al cliente.");
            }
        }

        // Guarda el registro del envío; si falla, no afecta el envío ni el ingreso
        private void RegistrarWhatsApp(int idIngreso, string placa, string? telefono, string tipo,
                                       bool exito, int? codigoRespuesta, string? idMensajeMeta, string? error)
        {
            var registro = new whatsapp_enviados
            {
                id_ingreso = idIngreso,
                placa = placa,
                telefono = telefono,
                tipo = tipo,
                exito = exito,
                codigo_respuesta = codigoRespuesta,
                id_mensaje_meta = idMensajeMeta,
                error = error?.Length > 500 ? error[..500] : error,
                id_usuario = HttpContext.Session.GetInt32("id"),
                fecha_envio = DateTime.Now
            };

            try
            {
                _context.whatsapp_enviados.Add(registro);
                _context.SaveChanges();
            }
            catch (Exception ex)
            {
                // Se suelta el registro para que no haga fallar el siguiente guardado
                _context.Entry(registro).State = EntityState.Detached;
                System.Diagnostics.Debug.WriteLine($"No se pudo registrar el WhatsApp: {ex.Message}");
            }
        }

        // Registro de WhatsApp enviados (solo administrador)
        [HttpGet]
        public IActionResult WhatsAppEnviados(DateTime? desde, DateTime? hasta, string? placa, string? estado, string? tipo)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return RedirectToAction("Index");
            }

            // Por defecto, solo lo de hoy
            var fechaDesde = (desde ?? DateTime.Today).Date;
            var fechaHasta = (hasta ?? DateTime.Today).Date.AddDays(1);

            var consulta = _context.whatsapp_enviados
                .AsNoTracking()
                .Include(w => w.Usuario)
                .Where(w => w.fecha_envio >= fechaDesde && w.fecha_envio < fechaHasta);

            if (!string.IsNullOrWhiteSpace(placa))
            {
                var placaFiltro = placa.Trim().ToUpper();
                consulta = consulta.Where(w => w.placa == placaFiltro);
            }

            if (estado == "exitoso") consulta = consulta.Where(w => w.exito);
            if (estado == "fallido") consulta = consulta.Where(w => !w.exito);

            if (tipo == "ingreso" || tipo == "reenvio")
            {
                consulta = consulta.Where(w => w.tipo == tipo);
            }

            // Resumen del período filtrado
            int total = consulta.Count();
            int exitosos = consulta.Count(w => w.exito);

            ViewBag.Total = total;
            ViewBag.Exitosos = exitosos;
            ViewBag.Fallidos = total - exitosos;

            // Máximo 500 filas para que la página no se vuelva pesada
            var registros = consulta
                .OrderByDescending(w => w.fecha_envio)
                .Take(500)
                .ToList();

            ViewData["FiltroDesde"] = fechaDesde;
            ViewData["FiltroHasta"] = fechaHasta.AddDays(-1);
            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroEstado"] = estado;
            ViewData["FiltroTipo"] = tipo;

            return View(registros);
        }

        // Despachos y cobros (punto 28, solo administrador): cada vehículo con ingreso, despacho o cobro en el
        // período, con quién lo recibió, quién lo solicitó, quién lo despachó, quién lo cobró y su liquidación
        [HttpGet]
        public IActionResult DespachosCobros(DateTime? desde, DateTime? hasta, string? placa)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return RedirectToAction("Index");
            }

            // Por defecto, solo lo de hoy
            var fechaDesde = (desde ?? DateTime.Today).Date;
            var fechaHasta = (hasta ?? DateTime.Today).Date.AddDays(1);

            var consulta = _context.ingresos
                .AsNoTracking()
                .Include(i => i.Ubicacion)
                .Where(i => (i.fecha_ingreso >= fechaDesde && i.fecha_ingreso < fechaHasta) ||
                            (i.fecha_salida >= fechaDesde && i.fecha_salida < fechaHasta) ||
                            (i.fecha_entrega >= fechaDesde && i.fecha_entrega < fechaHasta));

            if (!string.IsNullOrWhiteSpace(placa))
            {
                var placaFiltro = placa.Trim().ToUpper();
                consulta = consulta.Where(i => i.placa != null && i.placa.Contains(placaFiltro));
            }

            // Máximo 500 filas para que la página no se vuelva pesada
            var ingresos = consulta
                .OrderByDescending(i => i.fecha_ingreso)
                .Take(500)
                .ToList();

            // Nombres de todos los que aparecen: valet que recibió, quien parqueó, quien solicitó, valet de despacho
            // y quien cobró
            var idsUsuarios = ingresos
                .SelectMany(i => new int?[] { i.id_valet, i.usuario_parqueo, i.usuario_solicitud, i.valet_despacho, i.usuario_cobro })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            ViewBag.Nombres = _context.usuarios
                .Where(u => idsUsuarios.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);

            // Resumen del período: mismos criterios que la liquidación (valor del servicio; las propinas aparte)
            bool EnPeriodo(DateTime? fecha) => fecha >= fechaDesde && fecha < fechaHasta;
            var cobrados = ingresos.Where(i => i.estado_pago == "pagado" && EnPeriodo(i.fecha_entrega)).ToList();

            ViewBag.Vehiculos = ingresos.Count;
            ViewBag.Despachados = ingresos.Count(i => i.valet_despacho.HasValue && EnPeriodo(i.fecha_salida));
            ViewBag.Cobrados = cobrados.Count;
            ViewBag.TotalEfectivo = cobrados.Where(i => i.metodo_pago == "Efectivo").Sum(i => i.valor_servicio ?? 0);
            ViewBag.TotalTransferencias = cobrados.Where(i => i.metodo_pago != "Efectivo").Sum(i => i.valor_servicio ?? 0);
            ViewBag.TotalPropinas = cobrados.Sum(i => i.valor_propina ?? 0);
            ViewBag.SinLiquidar = cobrados.Count(i => i.estado_liquidacion != true);

            ViewData["FiltroDesde"] = fechaDesde;
            ViewData["FiltroHasta"] = fechaHasta.AddDays(-1);
            ViewData["FiltroPlaca"] = placa;

            return View(ingresos);
        }

        [HttpPost]
        public async Task<IActionResult> ReenviarWhatsApp(string placa, string? telefono)
        {

            // Buscamos el vehiculo
            if (string.IsNullOrWhiteSpace(placa))
            {

                return Json(new { success = false, message = "La placa es obligatoria." });

            }

            var ingreso = await _context.ingresos
                .Where(i => i.placa.ToUpper() == placa.ToUpper().Trim())
                .OrderByDescending(i => i.fecha_ingreso)
                .FirstOrDefaultAsync();

            if (ingreso == null)
            {

                return Json(new { success = false, message = "El ingreso no existe." });

            }

            string? numeroEnvio = !string.IsNullOrWhiteSpace(telefono)
                ? telefono.Trim()
                : ingreso.telefono;

            var (exito, mensaje) = await EnviarWhatsAppIngreso(ingreso.placa, ingreso.nombre_cliente, ingreso.id_ingreso, numeroEnvio, "reenvio");

            if (exito)
            {
                // El número nuevo se guarda solo si cambió y el envío funcionó
                if (numeroEnvio != ingreso.telefono)
                {
                    ingreso.telefono = numeroEnvio;
                    await _context.SaveChangesAsync();
                }

                return Json(new
                {
                    success = true,
                    message = $"Notificación reenviada con éxito al número {numeroEnvio}."
                });

            }
            else
            {

                return Json(new
                {

                    success = false,
                    message = $"No se pudo reenviar el mensaje: {mensaje}"

                });

            }
        }

        private void CargarDatosFormulario()
        {
            ViewBag.Valets = ValetsDisponibles();
            // Listas del formulario de ingreso en orden alfabético (punto 15)
            ViewBag.Bancos = _context.usuarios.Where(u => u.id_rol == 2 && u.estado == true)
                .OrderBy(u => u.nombres).ThenBy(u => u.apellidos).ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.OrderBy(p => p.nombre_parqueadero).ToList();
            ViewBag.UbicacionesS = _context.ubicacion_servicios.Where(u => u.estado == "activo")
                .OrderBy(u => u.nombre_ubicacion).ToList();

            // Obtener el usuario de la sesion
            var nombres = HttpContext.Session.GetString("nombre");
            var apellidos = HttpContext.Session.GetString("apellido");
            var id = HttpContext.Session.GetInt32("id");
            var rol = HttpContext.Session.GetInt32("id_rol");

            // Enviamos la sesion a la vista
            ViewBag.UsuarioSesion = new
            {
                nombre = nombres,
                apellido = apellidos,
                IdUsuario = id,
                usuario_rol = rol
            };
        }

        // Consultamos la tabla de ingresos

        public IActionResult ActualizarEstadosIngreso(int id_ingreso, string estado_pago, string estado_servicio)
        {
            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return NotFound();
            }

            // Validación 1: No permitir finalizar si no está pagado
            if (estado_servicio == "finalizado" && estado_pago != "pagado")
            {
                TempData["Error"] = $"El servicio del vehículo con placa {ingreso.placa} aun no esta pago";
                TempData["ErrorIngresoId"] = id_ingreso;
                return RedirectToAction("Tabla_Vehiculos");
            }

            // Validación 2: No permitir cancelar si ya está pagado
            if (estado_servicio == "cancelado" && estado_pago == "pagado")
            {
                TempData["Error"] = "No se puede cancelar un servicio que ya está pagado.";
                TempData["ErrorIngresoId"] = id_ingreso;
                return RedirectToAction("Tabla_Vehiculos");
            }

            ingreso.estado_pago = estado_pago;
            ingreso.estado_servicio = estado_servicio;

            if (estado_servicio == "finalizado")
            {
                ingreso.fecha_salida = DateTime.Now;
            }

            _context.SaveChanges();

            return RedirectToAction("Tabla_Vehiculos");
        }

        // =========================== PAGO Y CÓDIGOS DE SEGURIDAD =========================== \\

        [HttpPost]
        public IActionResult GenerarCodigoSeguridad(int id, string metodoPago)
        {
            try
            {
                var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id);
                if (ingreso == null)
                {
                    return Json(new { success = false, message = "Ingreso no encontrado" });
                }

                // Generar código aleatorio de 6 dígitos
                string codigo = Random.Shared.Next(100000, 1000000).ToString();

                // El código solo vive en la BD y expira en 1 minuto
                ingreso.codigo_seguridad = codigo;
                ingreso.fecha_expiracion_codigo = DateTime.Now.AddMinutes(1);

                // Actualizar método de pago
                ingreso.metodo_pago = metodoPago;
                _context.SaveChanges();

                return Json(new { success = true, codigo = codigo });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error generando código: {ex.Message}");
                return Json(new { success = false, message = "Error al generar código" });
            }
        }

        // Metodo para eliminar el codigo de seguridad despues de 1minuto
        [HttpPost]
        public IActionResult EliminarCodigoSeguridad(int id)
        {
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id);

            if (ingreso == null)
            {
                return Json(new
                {
                    success = false
                });
            }

            ingreso.codigo_seguridad = null;
            ingreso.fecha_expiracion_codigo = null;

            _context.SaveChanges();

            return Json(new
            {
                success = true
            });
        }
        [HttpGet]
        public IActionResult VerificarCodigoSeguridad(int id)
        {
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id);

            if (ingreso == null)
            {
                return Json(new
                {
                    success = false
                });
            }

            // Verificar si ya existe código
            bool tieneCodigo = !string.IsNullOrEmpty(ingreso.codigo_seguridad);

            return Json(new
            {
                success = true,
                tieneCodigo = tieneCodigo,
                codigo = ingreso.codigo_seguridad
            });
        }
        [HttpPost]
        public IActionResult ValidarCodigoSeguridad(int id, string codigo)
        {
            try
            {
                // Se valida contra la BD (sobrevive a reinicios del servidor)
                var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id);

                if (ingreso == null || string.IsNullOrEmpty(ingreso.codigo_seguridad))
                {
                    return Json(new { success = false, message = "No hay código generado para este ingreso" });
                }

                // Validar que no haya expirado (1 minuto)
                if (ingreso.fecha_expiracion_codigo == null || ingreso.fecha_expiracion_codigo < DateTime.Now)
                {
                    return Json(new { success = false, message = "Código expirado" });
                }

                // Validar que el código coincida
                if (ingreso.codigo_seguridad != codigo)
                {
                    return Json(new { success = false, message = "Código inválido" });
                }

                // Código válido: se borra para que no se reutilice
                ingreso.codigo_seguridad = null;
                ingreso.fecha_expiracion_codigo = null;
                _context.SaveChanges();

                return Json(new { success = true, message = "Código validado correctamente" });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error validando código: {ex.Message}");
                return Json(new { success = false, message = "Error al validar código" });
            }
        }

        [HttpPost]
        public IActionResult FinalizarServicio([FromBody] FinalizarServicioDTO dto)
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            try
            {
                if (dto == null)
                {
                    return Json(new
                    {
                        success = false,
                        message = "No se recibieron datos."
                    });
                }

                var ingreso = _context.ingresos
                    .FirstOrDefault(i => i.id_ingreso == dto.Id);

                if (ingreso == null)
                {
                    return Json(new
                    {
                        success = false,
                        message = "Ingreso no encontrado."
                    });
                }

                // Mismo criterio que el botón Cobrar (punto 32): despachado, con valet de despacho y sin pagar
                if (!IngresoReglas.PuedeCobrar(ingreso))
                {
                    return Json(new
                    {
                        success = false,
                        message = $"El vehículo {ingreso.placa} solo se puede cobrar cuando ya fue despachado y tiene valet de despacho."
                    });
                }

                // Si el método de pago es transferencia o QR,
                // la foto es obligatoria.
                if (ingreso.metodo_pago == "Transferencia" || ingreso.metodo_pago == "QR")
                {
                    if (string.IsNullOrWhiteSpace(dto.FotoBase64))
                    {
                        return Json(new
                        {
                            success = false,
                            message = "Debe tomar la foto de la transferencia."
                        });
                    }

                    try
                    {
                        string base64Limpio = dto.FotoBase64.Contains(",")
                            ? dto.FotoBase64.Split(',')[1]
                            : dto.FotoBase64;

                        // Validar que realmente sea Base64 válido
                        ingreso.foto_transferencia =
                            Convert.FromBase64String(base64Limpio);
                    }
                    catch
                    {
                        return Json(new
                        {
                            success = false,
                            message = "La imagen recibida no es válida."
                        });
                    }
                }

                ingreso.estado_servicio = dto.EstadoServicio;
                ingreso.estado_pago = "pagado";

                // Si el cliente no pagó por su enlace el valor sigue en 0: se guarda el de la ubicación,
                // para que liquidaciones y reportes no lo sumen en 0
                if ((ingreso.valor_servicio ?? 0) == 0)
                {
                    ingreso.valor_servicio = _context.ubicacion_servicios
                        .Where(u => u.id_ubicacion == ingreso.id_ubicacion)
                        .Select(u => (decimal?)u.valor_servicio)
                        .FirstOrDefault() ?? 0;
                }

                // El cobro terminó: el código ya no sirve (con o sin validación del cliente)
                ingreso.codigo_seguridad = null;
                ingreso.fecha_expiracion_codigo = null;

                if (dto.EstadoServicio == "finalizado")
                {
                    // Se conserva la hora del despacho (la usa el reporte de despachos y cobros, punto 28);
                    // solo se pone si nunca se despachó
                    ingreso.fecha_salida ??= DateTime.Now;
                    ingreso.fecha_entrega = DateTime.Now;
                    ingreso.usuario_cobro = idUsuario;
                }

                ingreso.rol_cobrador = rolUsuario switch
                {
                    1 => "valet",
                    2 => "banco",
                    3 => "admin",
                    _ => "otro"
                };

                _context.SaveChanges();

                // La alerta verde se muestra en la tabla después de recargar
                TempData["Exito"] = "Servicio finalizado correctamente.";
                TempData["Sonido"] = "pago";

                return Json(new
                {
                    success = true,
                    message = "Servicio finalizado correctamente."
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Error finalizando servicio: {ex.Message}");

                return Json(new
                {
                    success = false,
                    message = "Error al finalizar el servicio."
                });
            }
        }

        public override void OnActionExecuting(Microsoft.AspNetCore.Mvc.Filters.ActionExecutingContext context)
        {
            // Verifica primero si el usuario tiene sesión, si no, lo manda a login inmediatamente
            if (string.IsNullOrEmpty(HttpContext.Session.GetString("dni")))
            {
                context.Result = new RedirectToActionResult("Login", "Auth", null);
                return;
            }

            // Cabeceras mágicas para evitar que el navegador guarde la página
            HttpContext.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            HttpContext.Response.Headers["Pragma"] = "no-cache";
            HttpContext.Response.Headers["Expires"] = "-1";

            base.OnActionExecuting(context);
        }

        // =========================== Usuario =========================== \\

        // Acción para editar el usuario desde el panel del admin
        [HttpPost]
        public IActionResult EditarUsuario(int id_usuario, string dni, string nombre, string apellido, string telefono, int edad, int id_rol, string correo, bool estado, string? avatarBase64 = null)
        {
            // Validar si el nuevo DNI ya le pertenece a OTRO usuario
            bool existeDni = _context.usuarios
                .Any(u => u.dni == dni && u.id_usuario != id_usuario && u.estado == true);

            // Validar si el correo ya le pertence a OTRO usuario
            bool existeCorreo = _context.usuarios
                .Any(u => u.correo != null && u.correo.Trim().ToLower() == correo.Trim().ToLower() && u.id_usuario != id_usuario && u.estado == true);

            if (existeDni)
            {
                TempData["Error"] = $"El número de identificación (DNI) '{dni}' ya está en uso por otro usuario.";
                return RedirectToAction("Administrador");
            }
            if (existeCorreo)
            {
                TempData["Error"] = $"El correo '{correo}' ya está en uso por otro usuario.";
                return RedirectToAction("Administrador");
            }

            var usuario = _context.usuarios.FirstOrDefault(u => u.id_usuario == id_usuario);
            if (usuario != null)
            {
                usuario.dni = dni;
                usuario.nombres = nombre;
                usuario.apellidos = apellido;
                usuario.telefono = telefono;
                usuario.edad = edad;
                usuario.id_rol = id_rol;
                usuario.correo = correo;
                usuario.estado = estado;

                // Procesar imagen si viene en base64
                if (!string.IsNullOrWhiteSpace(avatarBase64))
                {
                    try
                    {
                        // Crear directorio si no existe
                        string uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "usuarios");
                        if (!Directory.Exists(uploadsFolder))
                        {
                            Directory.CreateDirectory(uploadsFolder);
                        }

                        // Generar nombre único para la imagen
                        string fileName = $"usuario_{id_usuario}_{DateTime.Now:yyyyMMddHHmmss}.jpg";
                        string filePath = Path.Combine(uploadsFolder, fileName);

                        // Convertir base64 a bytes y guardar
                        var base64Data = avatarBase64.Contains(",") ? avatarBase64.Split(',')[1] : avatarBase64;
                        byte[] imageBytes = Convert.FromBase64String(base64Data);

                        System.IO.File.WriteAllBytes(filePath, imageBytes);

                        // Guardar la URL relativa en la BD
                        usuario.imagen_usuario = $"/uploads/usuarios/{fileName}";
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Error al guardar imagen: {ex.Message}");
                    }
                }

                _context.SaveChanges();

                // Guardar la URL de imagen en la sesión (siempre, sea nueva o existente)
                if (!string.IsNullOrEmpty(usuario.imagen_usuario))
                {
                    HttpContext.Session.SetString("imagen_usuario_url", usuario.imagen_usuario);
                }

                TempData["Mensaje"] = "Los datos del usuario se actualizaron correctamente.";
            }
            return RedirectToAction("Administrador");
        }

        // =========================== Ubicacion =========================== \\

        // Acción para registrar una nueva ubicación
        [HttpPost]
        public IActionResult RegistrarUbicacion(string nombre_ubicacion, string direccion, string ciudad, decimal valor_servicio)
        {
            try
            {
                // Validar si la ubicación ya existe por nombre
                bool existeUbicacion = _context.ubicacion_servicios
                    .Any(u => u.nombre_ubicacion.Trim().ToLower() == nombre_ubicacion.Trim().ToLower());

                // Validar si la dirección ya existe
                bool existeDireccion = _context.ubicacion_servicios
                    .Any(u => u.direccion.Trim().ToLower() == direccion.Trim().ToLower());

                if (existeUbicacion)
                {
                    TempData["Error"] = $"La ubicación con el nombre '{nombre_ubicacion}' ya se encuentra registrada en el sistema.";
                    return RedirectToAction("Administrador");
                }
                if (existeDireccion)
                {
                    TempData["Error"] = $"Ya existe una ubicación registrada con la dirección '{direccion}'.";
                    return RedirectToAction("Administrador");
                }

                var nuevaUbicacion = new ubicacion_servicios
                {
                    nombre_ubicacion = nombre_ubicacion,
                    direccion = direccion,
                    ciudad = ciudad,
                    valor_servicio = valor_servicio
                };

                _context.ubicacion_servicios.Add(nuevaUbicacion);
                _context.SaveChanges();

                TempData["Mensaje"] = "¡La ubicación se ha registrado exitosamente en el sistema!";
            }
            catch (Exception)
            {
                TempData["Error"] = "Ocurrió un error al registrar la ubicación. Por favor, intenta de nuevo.";
            }

            return RedirectToAction("Administrador");
        }

        // Acción para editar una ubicación desde el panel de admin
        [HttpPost]
        public IActionResult EditarUbicacion(int id_ubicacion, string nombre_ubicacion, string direccion, string ciudad, decimal valor_servicio)
        {
            // Validar nombre duplicado (excluyendo el actual)
            bool existeNombre = _context.ubicacion_servicios
                .Any(u => u.nombre_ubicacion.Trim().ToLower() == nombre_ubicacion.Trim().ToLower() && u.id_ubicacion != id_ubicacion);

            // Validar dirección duplicada (excluyendo el actual)
            bool existeDireccion = _context.ubicacion_servicios
                .Any(u => u.direccion.Trim().ToLower() == direccion.Trim().ToLower() && u.id_ubicacion != id_ubicacion);

            if (existeNombre)
            {
                TempData["Error"] = $"Ya existe una ubicación con el nombre '{nombre_ubicacion}'.";
                return RedirectToAction("Administrador");
            }
            if (existeDireccion)
            {
                TempData["Error"] = $"Ya existe una ubicación con la dirección '{direccion}'.";
                return RedirectToAction("Administrador");
            }

            var ubicacion = _context.ubicacion_servicios.FirstOrDefault(u => u.id_ubicacion == id_ubicacion);
            if (ubicacion != null)
            {
                ubicacion.nombre_ubicacion = nombre_ubicacion;
                ubicacion.direccion = direccion;
                ubicacion.ciudad = ciudad;
                ubicacion.valor_servicio = valor_servicio;
                _context.SaveChanges();
                TempData["Mensaje"] = "La ubicación se actualizó correctamente.";
            }
            else
            {
                TempData["Error"] = "No se encontró la ubicación a editar.";
            }
            return RedirectToAction("Administrador");
        }

        // =========================== Parqueadero =========================== \\

        // Acción para registrar un nuevo parqueadero
        [HttpPost]
        public IActionResult RegistrarParqueadero(string nombre_parqueadero, string direccion, string ciudad, decimal tarifa)
        {
            try
            {
                // Validar si el parqueadero ya existe por nombre
                bool existeParqueadero = _context.parqueaderos
                    .Any(p => p.nombre_parqueadero.Trim().ToLower() == nombre_parqueadero.Trim().ToLower());

                // Validar si la dirección ya existe
                bool existeDireccion = _context.parqueaderos
                    .Any(p => p.direccion.Trim().ToLower() == direccion.Trim().ToLower());

                if (existeParqueadero)
                {
                    TempData["Error"] = $"El parqueadero con el nombre '{nombre_parqueadero}' ya se encuentra registrado en el sistema.";
                    return RedirectToAction("Administrador");
                }
                if (existeDireccion)
                {
                    TempData["Error"] = $"Ya existe un parqueadero registrado con la dirección '{direccion}'.";
                    return RedirectToAction("Administrador");
                }

                var nuevoParqueadero = new parqueaderos
                {
                    nombre_parqueadero = nombre_parqueadero,
                    direccion = direccion,
                    ciudad = ciudad,
                    tarifa = tarifa
                };

                _context.parqueaderos.Add(nuevoParqueadero);
                _context.SaveChanges();

                TempData["Mensaje"] = "¡El parqueadero se ha registrado exitosamente en el sistema!";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error Parqueadero: {ex.Message}");
                TempData["Error"] = "Ocurrió un error al registrar el parqueadero. Por favor, intenta de nuevo.";
            }

            return RedirectToAction("Administrador");
        }

        // Acción para editar un parqueadero desde el panel de admin
        [HttpPost]
        public IActionResult EditarParqueadero(int id_parqueadero, string nombre_parqueadero, string direccion, string ciudad, decimal tarifa)
        {
            // Validar nombre duplicado (excluyendo el actual)
            bool existeNombre = _context.parqueaderos
                .Any(p => p.nombre_parqueadero.Trim().ToLower() == nombre_parqueadero.Trim().ToLower() && p.id_parqueadero != id_parqueadero);

            // Validar dirección duplicada (excluyendo el actual)
            bool existeDireccion = _context.parqueaderos
                .Any(p => p.direccion.Trim().ToLower() == direccion.Trim().ToLower() && p.id_parqueadero != id_parqueadero);

            if (existeNombre)
            {
                TempData["Error"] = $"Ya existe un parqueadero con el nombre '{nombre_parqueadero}'.";
                return RedirectToAction("Administrador");
            }
            if (existeDireccion)
            {
                TempData["Error"] = $"Ya existe un parqueadero con la dirección '{direccion}'.";
                return RedirectToAction("Administrador");
            }

            var parqueadero = _context.parqueaderos.FirstOrDefault(p => p.id_parqueadero == id_parqueadero);
            if (parqueadero != null)
            {
                parqueadero.nombre_parqueadero = nombre_parqueadero;
                parqueadero.direccion = direccion;
                parqueadero.ciudad = ciudad;
                parqueadero.tarifa = tarifa;
                _context.SaveChanges();
                TempData["Mensaje"] = "Los datos del parqueadero se actualizaron correctamente.";
            }
            else
            {
                TempData["Error"] = "No se encontró el parqueadero a deshabilitar.";
            }
            return RedirectToAction("Administrador");
        }

        // Acción para deshabilitar una ubicación desde el panel del admin
        [HttpPost]
        public IActionResult DeshabilitarUbicacion(int id_ubicacion)
        {
            var ubicacion = _context.ubicacion_servicios.FirstOrDefault(u => u.id_ubicacion == id_ubicacion);
            if (ubicacion != null)
            {
                ubicacion.estado = "inactivo";
                _context.SaveChanges();
                TempData["Mensaje"] = "La ubicación fue deshabilitada exitosamente.";
            }
            else
            {
                TempData["Error"] = "No se encontró la ubicación a deshabilitar.";
            }
            return RedirectToAction("Administrador");
        }

        // Acción para deshabilitar un parqueadero desde el panel del admin
        [HttpPost]
        public IActionResult DeshabilitarParqueadero(int id_parqueadero)
        {
            var parqueadero = _context.parqueaderos.FirstOrDefault(p => p.id_parqueadero == id_parqueadero);
            if (parqueadero != null)
            {
                parqueadero.estado = "inactivo";
                _context.SaveChanges();
                TempData["Mensaje"] = "El parqueadero fue deshabilitado exitosamente.";
            }
            else
            {
                TempData["Error"] = "No se encontró el parqueadero a deshabilitar.";
            }
            return RedirectToAction("Administrador");
        }

        // =================== Nuevos métodos para VistaKey =================== //

        // Filas de la tabla de VistaKey para el refresco automático (cada 10 s): las mismas que arma la
        // página, con sus filtros. Antes el refresco las armaba aparte en JS con otras reglas: mostraba
        // Parquear donde no iba y les quitaba Despachar a los solicitados.
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult FilasVistaKey(string? placa, string? estado_servicio)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Mismos roles que pueden entrar a VistaKey: Key (4), Valet (1) y Admin (3)
            if (!idUsuarioSesion.HasValue || (rolUsuario != 4 && rolUsuario != 1 && rolUsuario != 3))
            {
                return Unauthorized();
            }

            // Valet y admin usan el parqueadero que eligieron en el modal; el Key, el de su turno
            var idParqueadero = rolUsuario == 4
                ? _context.sesiones
                    .Where(s => s.id_usuario == idUsuarioSesion && s.fecha_fin == null)
                    .Select(s => s.id_parqueadero)
                    .FirstOrDefault()
                : HttpContext.Session.GetInt32("id_parqueadero_sesion");

            // Sin parqueadero (Key sin turno, o valet/admin que aún no lo elige) se dejan las filas que hay
            if (!idParqueadero.HasValue)
            {
                return Unauthorized();
            }

            return PartialView("_FilasKey", IngresosVistaKey(idParqueadero, placa, estado_servicio));
        }

        [HttpPost]
        public IActionResult fotoParqueo(int id_ingreso, string fotoBase64)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuarioSesion.HasValue || rolUsuario != 1 && rolUsuario != 3)
            {
                return Forbid();
            }

            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return NotFound();
            }

            if (ingreso.id_valet != idUsuarioSesion.Value)
            {
                TempData["Error"] = "Solo el valet asignado puede registrar la foto del vehículo.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            if (ingreso.foto_estacionamiento)
            {
                TempData["Error"] = "La evidencia del parqueo ya fue registrada.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            if (string.IsNullOrWhiteSpace(fotoBase64))
            {
                TempData["Error"] = "Debe capturar una foto del vehículo.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            try
            {
                var base64Data = fotoBase64.Contains(",")
                    ? fotoBase64.Split(',')[1]
                    : fotoBase64;

                var imagen = new imagenes
                {
                    id_ingreso = id_ingreso,
                    dato_imagen = Convert.FromBase64String(base64Data)
                };

                ingreso.foto_estacionamiento = true;

                _context.imagenes.Add(imagen);
                _context.SaveChanges();

                return RedirectToAction("Tabla_Vehiculos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en fotoParqueo: {ex.Message}");
                TempData["Error"] = "No fue posible guardar la foto del vehículo.";
                return RedirectToAction("Tabla_Vehiculos");
            }
        }

        [HttpPost]
        public IActionResult fotoTransferencia(int id_ingreso, string fotoBase64)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Verificamos que llegue el id
            if (id_ingreso <= 0)
            {
                TempData["Error"] = "El ingreso no es válido.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            // Verificamos que llegue la foto
            if (string.IsNullOrWhiteSpace(fotoBase64))
            {
                TempData["Error"] = "Debe capturar una foto de la transferencia.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                TempData["Error"] = "No se encontró el ingreso.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            if (ingreso.foto_transferencia != null)
            {
                TempData["Error"] = "La evidencia de la transferencia ya fue registrada.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            try
            {
                // Si viene así:
                // data:image/jpeg;base64,/9j/4AAQSk...

                string base64Data = fotoBase64.Contains(",")
                    ? fotoBase64.Split(',')[1]
                    : fotoBase64;

                // Validar que realmente sea Base64 válido
                byte[] imagenBytes = Convert.FromBase64String(base64Data);

                // Guardar el Base64 completo o solo la parte limpia
                // Recomiendo guardar el Base64 completo para mostrarlo directamente en HTML

                ingreso.foto_transferencia = imagenBytes;

                _context.ingresos.Update(ingreso);
                _context.SaveChanges();

                TempData["Success"] = "Foto de la transferencia registrada correctamente.";

                return RedirectToAction("Tabla_Vehiculos");
            }
            catch (FormatException)
            {
                TempData["Error"] = "La imagen recibida no tiene un formato válido.";
                return RedirectToAction("Tabla_Vehiculos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Error en fotoTransferencia: {ex.Message}");

                TempData["Error"] =
                    "No fue posible guardar la foto de la transferencia.";

                return RedirectToAction("Tabla_Vehiculos");
            }
        }

                // Datos para el panel de información del vehículo
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerInfoIngreso(int idIngreso)
        {
            var ingreso = _context.ingresos
                .Include(i => i.Ubicacion)
                .Include(i => i.Parqueadero)
                .FirstOrDefault(i => i.id_ingreso == idIngreso);

            if (ingreso == null)
            {
                return NotFound();
            }

            // Nombres del valet que lo ingresó, del que lo trae de vuelta, del banco, de quien lo solicitó y de
            // quien lo parqueó
            var idsValets = new int?[] { ingreso.id_valet, ingreso.valet_despacho, ingreso.id_banco, ingreso.usuario_solicitud, ingreso.usuario_parqueo }
                .Where(id => id.HasValue)
                .Select(id => id.Value)
                .ToList();

            var nombres = _context.usuarios
                .Where(u => idsValets.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);

            return Json(new
            {
                placa = ingreso.placa,
                fechaIngreso = ingreso.fecha_ingreso?.ToString("dd/MM/yyyy HH:mm"),
                fechaSalida = ingreso.fecha_salida?.ToString("dd/MM/yyyy HH:mm"),
                valetIngreso = ingreso.id_valet.HasValue ? nombres.GetValueOrDefault(ingreso.id_valet.Value) : null,
                valetDespacho = ingreso.valet_despacho.HasValue ? nombres.GetValueOrDefault(ingreso.valet_despacho.Value) : null,
                banco = nombres.GetValueOrDefault(ingreso.id_banco),
                lugarEntrega = ingreso.lugar_entrega ?? ingreso.Ubicacion?.nombre_ubicacion,
                lugarIngreso = ingreso.Ubicacion?.nombre_ubicacion,
                parqueadero = ingreso.Parqueadero?.nombre_parqueadero,
                objetosValor = ingreso.notas,
                estadoPago = ingreso.estado_pago,
                estadoServicio = ingreso.estado_servicio,
                nombreCliente = ingreso.nombre_cliente,
                telefono = ingreso.telefono,
                firma = ingreso.firma != null
                    ? "data:image/png;base64," + Convert.ToBase64String(ingreso.firma)
                    : null,
                // Solo el enlace: la imagen se descarga aparte para no hacer pesada la respuesta
                fotoTransferencia = ingreso.foto_transferencia != null
                    ? Url.Action(nameof(FotoTransferenciaIngreso), new { idIngreso = ingreso.id_ingreso })
                    : null,
                puedeSolicitar = PuedeSolicitarOperador(HttpContext.Session.GetInt32("id_rol"), ingreso.estado_servicio, ingreso.estado_pago),
                // Banco y admin pueden asignar valet a un vehículo que no tiene (punto 4)
                puedeAsignarValet = (HttpContext.Session.GetInt32("id_rol") is 2 or 3) && IngresoReglas.PuedeRecibirValet(ingreso),
                // Valet, banco y admin parquean desde Información sin ir a VistaKey (puntos 13 y 18);
                // misma regla que el botón del Key y que valida ActualizarEstadoKey
                puedeParquear = (HttpContext.Session.GetInt32("id_rol") is 1 or 2 or 3) && IngresoReglas.PuedeParquear(ingreso),
                // Quién y cuándo se solicitó (puntos 26 y 27): sin usuario = el cliente desde su enlace
                fechaSolicitud = ingreso.fecha_solicitud?.ToString("dd/MM/yyyy HH:mm"),
                solicitadoPor = !ingreso.fecha_solicitud.HasValue
                    ? null
                    : ingreso.usuario_solicitud.HasValue
                        ? nombres.GetValueOrDefault(ingreso.usuario_solicitud.Value)
                        : "El cliente, desde su enlace",
                // Quién tocó Parquear y a qué hora (null en ingresos anteriores a este registro)
                fechaParqueo = ingreso.fecha_parqueo?.ToString("dd/MM/yyyy HH:mm"),
                parqueadoPor = ingreso.usuario_parqueo.HasValue ? nombres.GetValueOrDefault(ingreso.usuario_parqueo.Value) : null,
                // Reversar una solicitud hecha por error (punto 21): los mismos que pueden solicitar
                puedeReversar = (HttpContext.Session.GetInt32("id_rol") is 1 or 2 or 3) && IngresoReglas.PuedeReversarSolicitud(ingreso)
            });
        }

        // Reversar una solicitud hecha por error (punto 21): valet, banco y admin, solo mientras está
        // "solicitado". El vehículo vuelve al estado que tenía y se borran los datos de la solicitud.
        // Responde JSON: se usa desde Información y desde la burbuja sin recargar la página
        [HttpPost]
        public IActionResult ReversarSolicitud(int id_ingreso)
        {
            if (HttpContext.Session.GetInt32("id_rol") is not (1 or 2 or 3))
            {
                return Json(new { success = false, mensaje = "No tienes permiso para reversar solicitudes." });
            }

            var ingreso = _context.ingresos
                .Include(i => i.Ubicacion)
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (!IngresoReglas.PuedeReversarSolicitud(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya no está solicitado; no hay nada que reversar." });
            }

            // Solicitudes hechas antes de esta versión no guardaron el estado anterior: si tiene valet
            // se asume que estaba parqueado; si no, que esperaba valet
            var estadoAnterior = ingreso.estado_antes_solicitud
                ?? (ingreso.id_valet.HasValue ? "parqueado" : "esperando valet");

            // Si le asignaron valet mientras estaba solicitado ya no espera valet: queda activo, como en
            // actualizarValet (si no, quedaría bloqueado: no se podría parquear ni asignarle valet)
            if (estadoAnterior.Trim().ToLower() == "esperando valet" && ingreso.id_valet.HasValue)
            {
                estadoAnterior = "activo";
            }

            ingreso.estado_servicio = estadoAnterior;

            // Se deshace lo que guardó la solicitud: lugar de entrega (vuelve al del ingreso), temporizador
            // del cliente y quién/cuándo la hizo
            ingreso.lugar_entrega = ingreso.Ubicacion?.nombre_ubicacion;
            ingreso.fecha_fin_servicio = null;
            ingreso.usuario_solicitud = null;
            ingreso.fecha_solicitud = null;
            ingreso.estado_antes_solicitud = null;

            _context.SaveChanges();

            return Json(new { success = true, mensaje = $"Solicitud del vehículo {ingreso.placa} reversada. Volvió a {ingreso.estado_servicio}." });
        }

        // Devuelve la foto del comprobante de pago (transferencia / QR)
        [HttpGet]
        public IActionResult FotoTransferenciaIngreso(int idIngreso)
        {
            var foto = _context.ingresos
                .AsNoTracking()
                .Where(i => i.id_ingreso == idIngreso)
                .Select(i => i.foto_transferencia)
                .FirstOrDefault();

            if (foto == null || foto.Length == 0)
            {
                return NotFound();
            }

            return File(foto, "image/jpeg");
        }

        // Valet, banco o admin pueden solicitar el vehículo solo si está activo o parqueado
        // y todavía no está pagado (un vehículo pagado nunca se vuelve a solicitar)
        private static bool PuedeSolicitarOperador(int? rol, string? estadoServicio, string? estadoPago)
        {
            var estado = estadoServicio?.Trim().ToLower();
            var pago = estadoPago?.Trim().ToLower();

            return (rol == 1 || rol == 2 || rol == 3) &&
                   (estado == "activo" || estado == "parqueado") &&
                   pago != "pagado";
        }

        // El operador solicita el vehículo cuando el cliente llama y no lo pidió desde su enlace
        [HttpPost]
        public IActionResult SolicitarVehiculoOperador(int id_ingreso, string? lugar_entrega)
        {
            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                TempData["Error"] = "No se encontró el ingreso.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            if (!PuedeSolicitarOperador(HttpContext.Session.GetInt32("id_rol"), ingreso.estado_servicio, ingreso.estado_pago))
            {
                TempData["Error"] = "El vehículo no se puede solicitar en su estado actual o no tienes permiso.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            if (string.IsNullOrWhiteSpace(lugar_entrega))
            {
                TempData["Error"] = "Selecciona el lugar de entrega.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            // Con "Otra ubicación" el lugar se escribe a mano: tbl_ingresos.lugar_entrega es VARCHAR(50)
            if (lugar_entrega.Trim().Length > 50)
            {
                TempData["Error"] = "El lugar de entrega no puede tener más de 50 caracteres.";
                return RedirectToAction("Tabla_Vehiculos");
            }

            // Mismos datos que guarda la solicitud del cliente
            // Quién y cuándo (puntos 26 y 27) y el estado anterior para poder reversar (punto 21)
            ingreso.estado_antes_solicitud = ingreso.estado_servicio;
            ingreso.usuario_solicitud = HttpContext.Session.GetInt32("id");
            ingreso.fecha_solicitud = DateTime.Now;

            ingreso.estado_servicio = "solicitado";
            ingreso.fecha_fin_servicio = DateTime.Now.AddMinutes(20);
            ingreso.lugar_entrega = lugar_entrega.Trim();

            _context.SaveChanges();

            TempData["Exito"] = $"Vehículo {ingreso.placa} solicitado. Entrega en {ingreso.lugar_entrega}.";
            return RedirectToAction("Tabla_Vehiculos");
        }


        [HttpGet]
        public IActionResult ObtenerImagenesIngreso(int idIngreso)
        {
            System.Diagnostics.Debug.WriteLine("[ObtenerImagenesIngreso] Inicio de consulta de imágenes.");
            Console.WriteLine("[ObtenerImagenesIngreso] Inicio de consulta de imágenes.");

            var imagenes = _context.imagenes
                .AsNoTracking()
                .Where(i =>
                    i.id_ingreso == idIngreso &&
                    i.dato_imagen != null &&
                    i.dato_imagen.Length >= 3 &&
                    i.dato_imagen[0] == 0xFF &&
                    i.dato_imagen[1] == 0xD8 &&
                    i.dato_imagen[2] == 0xFF
                )
                .OrderBy(i => i.id_imagen)
                .Select(i => new
                {
                    i.id_imagen,
                    i.id_ingreso,
                    src = $"data:image/jpeg;base64,{Convert.ToBase64String(i.dato_imagen)}"
                })
                .ToList();

            System.Diagnostics.Debug.WriteLine(
                $"[ObtenerImagenesIngreso] Imágenes encontradas: {imagenes.Count}"
            );

            Console.WriteLine(
                $"[ObtenerImagenesIngreso] Imágenes encontradas: {imagenes.Count}"
            );

            return Json(new
            {
                success = true,
                total = imagenes.Count,
                imagenes
            });
        }


        [HttpGet]
        public IActionResult ObtenerVideosIngreso(int idIngreso)
        {
            System.Diagnostics.Debug.WriteLine("[ObtenerVideosIngreso] Inicio de consulta de videos.");
            Console.WriteLine("[ObtenerVideosIngreso] Inicio de consulta de videos.");

            var videos = _context.imagenes
                .AsNoTracking()
                .Where(i =>
                    i.id_ingreso == idIngreso &&
                    i.dato_imagen != null &&
                    i.dato_imagen.Length >= 4 &&
                    i.dato_imagen[0] == 0x1A &&
                    i.dato_imagen[1] == 0x45 &&
                    i.dato_imagen[2] == 0xDF &&
                    i.dato_imagen[3] == 0xA3
                )
                .OrderBy(i => i.id_imagen)
                // Solo se envía la URL: el video se descarga aparte y por partes cuando se reproduce
                .Select(i => new
                {
                    i.id_imagen,
                    i.id_ingreso
                })
                .ToList()
                .Select(i => new
                {
                    i.id_imagen,
                    i.id_ingreso,
                    src = Url.Action(nameof(VideoIngreso), new { idImagen = i.id_imagen })
                })
                .ToList();

            System.Diagnostics.Debug.WriteLine(
                $"[ObtenerVideosIngreso] Videos encontrados: {videos.Count}"
            );

            Console.WriteLine(
                $"[ObtenerVideosIngreso] Videos encontrados: {videos.Count}"
            );

            return Json(new
            {
                success = true,
                total = videos.Count,
                videos
            });
        }

        // Devuelve el archivo del video; con rangos el navegador solo descarga lo que reproduce
        [HttpGet]
        public IActionResult VideoIngreso(int idImagen)
        {
            var dato = _context.imagenes
                .AsNoTracking()
                .Where(i => i.id_imagen == idImagen)
                .Select(i => i.dato_imagen)
                .FirstOrDefault();

            if (dato == null || dato.Length == 0)
            {
                return NotFound();
            }

            return File(dato, "video/webm", enableRangeProcessing: true);
        }

        // Metodo para guardar la ubicacion del banco

        [HttpPost]
        public IActionResult GuardarUbicacionSesion(int? id_ubicacion)
        {
            System.Diagnostics.Debug.WriteLine($"[GuardarUbicacionSesion] Inicio. id_ubicacion={id_ubicacion}");
            Console.WriteLine($"[GuardarUbicacionSesion] Inicio. id_ubicacion={id_ubicacion}");

            if (id_ubicacion.HasValue && id_ubicacion.Value > 0)
            {
                HttpContext.Session.SetInt32("id_ubicacion", id_ubicacion.Value);
                System.Diagnostics.Debug.WriteLine($"[GuardarUbicacionSesion] Ubicación guardada en sesión: {id_ubicacion.Value}");
                Console.WriteLine($"[GuardarUbicacionSesion] Ubicación guardada en sesión: {id_ubicacion.Value}");

                return Json(new
                {
                    success = true,
                    id_ubicacion = id_ubicacion.Value,
                    message = "Ubicación guardada en sesión."
                });
            }

            HttpContext.Session.Remove("id_ubicacion");
            System.Diagnostics.Debug.WriteLine("[GuardarUbicacionSesion] Se eliminó la ubicación de la sesión.");
            Console.WriteLine("[GuardarUbicacionSesion] Se eliminó la ubicación de la sesión.");

            return Json(new
            {
                success = false,
                message = "No se recibió una ubicación válida."
            });
        }

        [HttpPost]
        public async Task<IActionResult> KeepAlive()
        {
            // 1. La sesión ya la revisa OnActionExecuting. Antes aquí se pedía User.Identity.IsAuthenticated,
            //    que nunca es true en esta app (no usa ese tipo de autenticación): el latido respondía 401
            //    siempre y los turnos se cerraban solos a los pocos minutos.

            // 2. Obtener el ID del usuario desde la sesión
            var idUsuario = HttpContext.Session.GetInt32("id");
            if (!idUsuario.HasValue)
            {
                return Unauthorized(new { success = false, message = "Identificador de usuario no válido" });
            }

            // 3. Buscar la sesión activa (aquella donde fecha_fin es NULL)
            var sesionActiva = await _context.sesiones
                .Where(s => s.id_usuario == idUsuario.Value && s.fecha_fin == null)
                .OrderByDescending(s => s.fecha_inicio) // Toma la última sesión abierta
                .FirstOrDefaultAsync();

            if (sesionActiva == null)
            {
                // Si no hay sesión activa abierta en la BD (fecha_fin != null)
                HttpContext.Session.Clear();
                return Unauthorized(new { success = false, message = "Sesión finalizada por inactividad" });
            }

            // 4. Renovar el timestamp de ultima_actividad
            sesionActiva.ultima_actividad = DateTime.Now;
            await _context.SaveChangesAsync();

            // 5. Refrescar variable de sesión local
            HttpContext.Session.SetString("UltimaActividad", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

            return Ok(new { success = true, message = "Sesión renovada" });
        }
    }
}
