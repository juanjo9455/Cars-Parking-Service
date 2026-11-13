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

            // Lo que pagó el cliente, si el banco lo escribió (solo cuando no pagó por la app)
            public decimal? ValorCobrado { get; set; }
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

            // El banco ve la zona en la que entró (ya no escoge ubicación)
            var nombreZona = NombreZona(ZonaSesion());
            ViewBag.ubicacion = nombreZona != null ? $"Zona {nombreZona}" : "Zona no disponible";

            // Lo que este usuario tiene pagado sin liquidar (una ubicación por cada vehículo)
            var pendientes = usuarioId.HasValue
                ? LiquidacionReglas.PorLiquidar(_context, usuarioId.Value).Select(i => i.id_ubicacion).ToList()
                : new List<int>();

            ViewBag.estadoLiquidacion = pendientes.Count == 0;   // true = puede cerrar sesión
            ViewBag.pendientesVehiculos = pendientes.Count;
            ViewBag.pendientesUbicaciones = pendientes.Distinct().Count();

            // "La línea de hoy" (Inicio): cuántos carros hay en cada estado en la zona en la que entró. Los abiertos sin
            // importar el día; los pagados, los entregados desde las 6 am (la jornada). Solo lee
            var inicioJornada = DateTime.Now.AddHours(-6).Date.AddHours(6);
            ViewBag.Linea = DeLaZona(_context.ingresos.AsNoTracking(), ZonaSesion())
                .Where(i => i.estado_servicio == "activo" || i.estado_servicio == "parqueado" || i.estado_servicio == "solicitado" ||
                            i.estado_servicio == "despachado" || (i.estado_servicio == "finalizado" && i.fecha_entrega >= inicioJornada))
                .GroupBy(i => i.estado_servicio)
                .Select(g => new { estado = g.Key, cantidad = g.Count() })
                .AsEnumerable()
                .GroupBy(x => (x.estado ?? "").Trim().ToLower())
                .ToDictionary(g => g.Key, g => g.Sum(x => x.cantidad));

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

                    // Los vehículos asignados a ese valet (recibidos)
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

                    // La zona en la que entró (turnos de antes de las zonas: su ubicación)
                    LugarActual = _context.zonas.Where(z => z.id_zona == grupo.First().s.id_zona).Select(z => z.nombre_zona).FirstOrDefault()
                                  ?? grupo.First().s.Ubicacion.nombre_ubicacion ?? "Sin zona",

                    // Los que registró ese banco ese día (antes: los abiertos de toda la zona, igual para todos los bancos)
                    VehiculosRecibidos = _context.ingresos.Count(i =>
                        i.id_banco == grupo.Key &&
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
                        i.estado_servicio != "finalizado" &&
                        i.estado_servicio != "cancelado")
                }

            ).ToList();

            // Liquidaciones del día, desde tbl_liquidacion (aunque el banco ya haya cerrado sesión). El día va de 6 am a
            // 6 am, como la jornada y el Dashboard: la liquidación de la madrugada es del día en que empezó el turno
            var inicioDia = FechaConsulta.AddHours(6);
            var finDia = inicioDia.AddDays(1);

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

            // Todos los vehículos que entraron ese día, en todas las zonas (va fuera de la tabla de valets)
            model.TotalVehiculos = _context.ingresos.Count(i => i.fecha_ingreso >= inicioDia && i.fecha_ingreso < finDia);

            return View(model);

        }

        // Vehículos que forman una liquidación: "Ver detalle" de Estado Turnos y filas desplegables de
        // Liquidaciones. Salen de sp_vehiculosLiquidacion (Database/liquidaciones-admin.sql)
        [HttpGet]
        public IActionResult DetalleLiquidacion(int id)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return Json(new { success = false, message = "No tienes permiso para ver liquidaciones." });
            }

            // Los comprobantes (QR / transferencia) de esta liquidación, sin traer las imágenes: se juntan por placa
            // y hora de entrega porque sp_vehiculosLiquidacion no trae el id del ingreso
            var fotos = _context.ingresos
                .AsNoTracking()
                .Where(i => i.id_liquidacion == id && i.foto_transferencia != null)
                .Select(i => new { i.id_ingreso, i.placa, i.fecha_entrega })
                .ToList();

            var vehiculos = _context.Database
                .SqlQueryRaw<vehiculo_liquidado>("EXEC sp_vehiculosLiquidacion @id_liquidacion",
                    new SqlParameter("@id_liquidacion", id))
                .ToList()
                .Select(v => new
                {
                    placa = v.placa,
                    entrega = v.fecha_entrega?.ToString("dd/MM HH:mm") ?? "—",
                    cobro = string.IsNullOrWhiteSpace(v.cobro) ? "—" : v.cobro,
                    rol = v.rol_cobrador,
                    metodo = v.metodo_pago,
                    valor = v.valor_servicio,
                    // En efectivo nunca hay propina: lo que entra es el servicio
                    propina = v.metodo_pago == "Efectivo" ? 0 : v.valor_propina,
                    cobrado = v.metodo_pago == "Efectivo" ? v.valor_servicio : v.total_cobrado,
                    ubicacion = v.nombre_ubicacion ?? "—",
                    foto = fotos
                        .Where(f => f.placa == v.placa && f.fecha_entrega == v.fecha_entrega)
                        .Select(f => Url.Action(nameof(FotoTransferenciaIngreso), new { idIngreso = f.id_ingreso }))
                        .FirstOrDefault()
                });

            return Json(new { success = true, vehiculos });
        }


        // =================== Turnos: vehículos del turno anterior =================== //

        // Vehículos sin cobrar de la zona cuyo banco ya no está de turno (sp_vehiculosPorRecibir): los ve el banco
        // que entra para recibirlos (ventana "Vehículos pendientes del turno anterior", recibir-vehiculos.js)
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult VehiculosPorRecibir()
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var idZona = ZonaSesion();

            if (HttpContext.Session.GetInt32("id_rol") != 2 || !idUsuario.HasValue || !idZona.HasValue)
            {
                return Json(new { success = true, vehiculos = Array.Empty<object>() });
            }

            var vehiculos = _context.Database
                .SqlQueryRaw<vehiculo_por_recibir>("EXEC sp_vehiculosPorRecibir @id_usuario, @id_zona, @ahora",
                    new SqlParameter("@id_usuario", idUsuario.Value),
                    new SqlParameter("@id_zona", idZona.Value),
                    new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now })
                .ToList()
                .Select(v => new
                {
                    id = v.id_ingreso,
                    placa = v.placa,
                    estado = v.estado_servicio,
                    ubicacion = v.nombre_ubicacion,
                    banco = v.banco_anterior,
                    turno = v.turno_anterior
                });

            return Json(new { success = true, vehiculos });
        }

        // El banco recibe los vehículos que escogió (sp_recibirVehiculos): pasan a su cargo y a su turno, y queda
        // el traspaso. Si otro banco los recibió primero, se le dice quién
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult RecibirVehiculos(int[] ids)
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var idZona = ZonaSesion();

            if (HttpContext.Session.GetInt32("id_rol") != 2 || !idUsuario.HasValue || !idZona.HasValue)
            {
                return Json(new { success = false, mensaje = "Solo el banco de turno puede recibir vehículos." });
            }

            if (ids == null || ids.Length == 0 || ids.Length > 200)
            {
                return Json(new { success = false, mensaje = "Escoge los vehículos que vas a recibir." });
            }

            var resultado = _context.Database
                .SqlQueryRaw<vehiculo_recibido>("EXEC sp_recibirVehiculos @id_usuario, @id_zona, @ids, @ahora",
                    new SqlParameter("@id_usuario", idUsuario.Value),
                    new SqlParameter("@id_zona", idZona.Value),
                    new SqlParameter("@ids", string.Join(",", ids.Distinct())),
                    new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now })
                .ToList();

            var recibidos = resultado.Count(r => r.recibido);
            var deOtros = resultado.Where(r => !r.recibido).Select(r => $"{r.placa} ({r.banco_actual})").ToList();

            var mensaje = recibidos > 0
                ? $"Recibiste {recibidos} vehículo{(recibidos == 1 ? "" : "s")}. Ya quedan a tu cargo."
                : "No recibiste ningún vehículo.";

            if (deOtros.Count > 0)
            {
                mensaje += $" Ya los tiene otro banco: {string.Join(", ", deOtros)}.";
            }

            return Json(new { success = recibidos > 0, recibidos, mensaje });
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
                (rolUsuario != 4 &&
                 rolUsuario != 1 &&
                  rolUsuario != 3 &&
                  rolUsuario != 2))
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

            // Parqueaderos de la zona en la que entró: el principal, el modal y el selector
            var parqueaderosZona = ParqueaderosZona(ZonaSesion());

            if (rolUsuario == 1 || rolUsuario == 3 || rolUsuario == 2)
            {
                // Sin parqueadero escogido entra al principal de su zona; el modal queda solo si la zona no tiene ninguno
                if (!idParqueaderoSesion.HasValue)
                {
                    idParqueaderoSesion = ParqueaderoPrincipal(parqueaderosZona)?.id_parqueadero;

                    if (idParqueaderoSesion.HasValue)
                    {
                        HttpContext.Session.SetInt32("id_parqueadero_sesion", idParqueaderoSesion.Value);
                    }
                }

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
            ViewBag.IdParqueaderoActual = parqueadero?.id_parqueadero;
            ViewBag.valets = ValetsDisponibles();
            ViewBag.idRol = rolUsuario;
            ViewBag.EstaEnParqueadero = idParqueaderoSesion.HasValue;
            // Modal y selector de parqueadero: solo los de la zona en la que entró
            ViewBag.Parqueaderos = parqueaderosZona;

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
                    i.estado_servicio != "cancelado" &&
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

        // Cambiar de parqueadero desde la vista Key sin salir y volver a entrar. El Key cambia su turno (su
        // parqueadero sale de tbl_sesiones); valet, banco y admin solo el que eligieron para esta sesión
        [HttpPost]
        public IActionResult CambiarParqueaderoVista(int id_parqueadero)
        {
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuario.HasValue || rolUsuario is not (1 or 2 or 3 or 4))
            {
                return RedirectToAction("Login", "Auth");
            }

            // Activo y de la zona en la que entró (o sin zona todavía)
            var zona = ZonaSesion();
            if (!_context.parqueaderos.Any(p => p.id_parqueadero == id_parqueadero && p.estado == "activo" &&
                                                (zona == null || p.id_zona == null || p.id_zona == zona)))
            {
                return RedirectToAction("VistaKey");
            }

            if (rolUsuario == 4)
            {
                SesionTurno.AbrirTurno(_context, HttpContext, idUsuario.Value, 4, null, id_parqueadero, zona);
            }
            else
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

            // Solo las de la zona en la que entró (antes el banco veía las de su ubicación)
            query = DeLaZona(query, ZonaSesion());

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

            // El admin también se entera de las de las otras zonas, aparte y con el nombre de la zona: al tocarlas
            // ve la tabla de esa zona (filtro Zona) sin cambiar la de su sesión, así no se mezclan los ingresos
            var zonaSesion = ZonaSesion();
            var otrasZonas = rolUsuario == 3 && zonaSesion.HasValue
                ? SolicitudesOtrasZonas(zonaSesion.Value)
                : new List<object>();

            // Retornamos JSON
            return Json(new
            {
                cantidad = cantidad,
                solicitudes = solicitudes,
                otrasZonas,
                serverTime = DateTime.Now.ToString("O")
            });
        }

        // Solicitados que no son de la zona dada (la del ingreso o, si no la tiene guardada, la de su ubicación)
        private List<object> SolicitudesOtrasZonas(int zona)
        {
            var nombres = _context.zonas.AsNoTracking().ToDictionary(z => z.id_zona, z => z.nombre_zona);

            return _context.ingresos
                .AsNoTracking()
                .Where(i => i.estado_servicio != null && i.estado_servicio.Trim().ToLower() == "solicitado")
                .Where(i => !(i.id_zona == zona || (i.id_zona == null && i.Ubicacion != null && i.Ubicacion.id_zona == zona)))
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,
                    lugar_entrega = i.lugar_entrega,
                    id_zona = i.id_zona ?? (i.Ubicacion != null ? i.Ubicacion.id_zona : null)
                })
                .ToList()
                .Select(i => (object)new
                {
                    i.id,
                    i.placa,
                    i.lugar_entrega,
                    i.id_zona,
                    zona = i.id_zona.HasValue ? nombres.GetValueOrDefault(i.id_zona.Value, "Sin zona") : "Sin zona"
                })
                .ToList();
        }

        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerDespachados()
        {
            // Consulta base: todos los usuarios ven todos los despachados, como en solicitados y esperando valet
            var query = _context.ingresos
                .Include(i => i.Banco)
                .Where(i =>
                    i.estado_servicio != null &&
                    i.estado_servicio.Trim().ToLower() == "despachado"
                )
                .AsQueryable();

            // Solo los de la zona en la que entró
            query = DeLaZona(query, ZonaSesion());

            // Convertimos datos
            var despachados = query
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,

                    // Aquí interesa el valet que lo despachó, no el que lo recibió
                    nombre_valet = _context.usuarios
                        .Where(u => u.id_usuario == i.valet_despacho)
                        .Select(u => u.nombres)
                        .FirstOrDefault() ?? "Sin valet",

                    nombre_banco = i.Banco != null
                        ? i.Banco.nombres
                        : "Sin banco",

                    // Dónde se entrega, como en solicitados (si no se pidió otro lugar, el de ingreso)
                    lugar_entrega = i.lugar_entrega ?? (i.Ubicacion != null ? i.Ubicacion.nombre_ubicacion : null)
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

            // Solo los de la zona en la que entró
            query = DeLaZona(query, ZonaSesion());

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

            // Zonas para el campo Zona de ubicaciones y parqueaderos (Database/zonas.sql)
            ViewBag.Zonas = _context.zonas.AsNoTracking().OrderBy(z => z.nombre_zona).ToList();

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

        public IActionResult Tabla_Vehiculos(string placa, string? lugar, string[]? estado_servicio, string estado_pago, string? parqueadero, DateTime? fechaInicio, int? usuario, string? zona, int? turno, string? como)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");

            ViewBag.mostrarMenu = false;

            if (!idUsuarioSesion.HasValue)
            {
                return RedirectToAction("Login", "Auth");
            }

            int idUsuario = idUsuarioSesion.Value;

            // La zona de la sesión; el admin puede escoger otra o todas (filtro Zona)
            var zonaTabla = ZonaTabla(zona);
            var todasLasZonas = EsAdmin() && zona == "todas";

            // En el título: la zona que se está viendo
            ViewBag.ubicacion = todasLasZonas ? "Todas las zonas" : NombreZona(zonaTabla);

            var estadosFiltro = EstadosFiltro();
            var estados = EstadosMarcados(estado_servicio, estadosFiltro);

            var ingresos = IngresosTabla(idUsuario, placa, lugar, estados, estado_pago, parqueadero, fechaInicio, usuario, zonaTabla, turno, como);
            ViewBag.NombresSolicitud = NombresSolicitud(ingresos);
            ViewBag.ValoresUbicacion = ValoresUbicacion();
            int totalRegistros = ingresos.Count();

            // Filtros Usuario, Zona y Turno, solo para el admin: usuarios activos en orden alfabético, las zonas del
            // login y los turnos
            ViewBag.UsuariosFiltro = EsAdmin()
                ? _context.usuarios.AsNoTracking().Where(u => u.estado).OrderBy(u => u.nombres).ThenBy(u => u.apellidos).ToList()
                : new List<usuarios>();
            ViewBag.ZonasFiltro = EsAdmin() ? _context.zonas.FromSqlRaw("EXEC sp_zonas").AsNoTracking().ToList() : new List<zonas>();
            ViewBag.TurnosFiltro = EsAdmin() ? TurnosFiltro() : new List<(int, string)>();
            ViewData["FiltroUsuario"] = usuario;
            ViewData["FiltroComo"] = como;
            ViewData["FiltroZona"] = todasLasZonas ? "todas" : zonaTabla?.ToString();
            ViewData["FiltroTurno"] = turno;

            ViewBag.TotalRegistros = totalRegistros;

            // Listas de los filtros: solo las de la zona que se ve, en orden alfabético (punto 15)
            ViewBag.Ubicaciones = UbicacionesZona(zonaTabla);
            ViewBag.Parqueaderos = ParqueaderosZona(zonaTabla);
            ViewBag.Valets = ValetsDisponibles();
            ViewBag.EstadosFiltro = estadosFiltro;


            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroLugar"] = lugar;
            ViewData["FiltroEstadoServicio"] = estados;
            ViewData["FiltroEstadoPago"] = estado_pago;
            ViewData["FiltroParqueadero"] = parqueadero;
            ViewData["FiltroFechaInicio"] = fechaInicio;

            return View(ingresos);
        }

        // Ingresos de la tabla según los filtros y el rol (procedimiento sp_consultarRegistros). Los usan
        // la página y su refresco automático (FilasIngresos, punto 16) para mostrar exactamente lo mismo
        private List<ingresos> IngresosTabla(int idUsuario, string? placa, string? lugar, string[] estados,
            string? estado_pago, string? parqueadero, DateTime? fechaIngreso, int? usuarioFiltro, int? idZona, int? turno, string? como)
        {
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            // Convertir placa a mayúsculas
            string? placaUpper = !string.IsNullOrEmpty(placa) ? placa.Trim().ToUpper() : null;
            string? nombreUbicacion = !string.IsNullOrEmpty(lugar) ? lugar : null;
            // Varios estados van separados por coma; con "todos" (o ninguno) se consulta sin filtrar
            string? estadoServicio = estados.Length == 0 || estados.Contains("todos") ? null : string.Join(",", estados);
            string? estadoPago = !string.IsNullOrEmpty(estado_pago) ? estado_pago : null;
            string? nombreParqueadero = !string.IsNullOrEmpty(parqueadero) ? parqueadero : null;


            var parametros = new List<SqlParameter>
{
                new SqlParameter("@placa", placaUpper ?? (object)DBNull.Value),
                new SqlParameter("@lugar", nombreUbicacion ?? (object)DBNull.Value),
                new SqlParameter("@estado_servicio", estadoServicio ?? (object)DBNull.Value),
                new SqlParameter("@estado_pago", estadoPago ?? (object)DBNull.Value),
                new SqlParameter("@parqueadero", nombreParqueadero ?? (object)DBNull.Value),
                // Un solo día (filtro Fecha de ingreso): la misma fecha de inicio y de fin. Vacía = todas las fechas
                new SqlParameter("@fecha_inicio", fechaIngreso.HasValue ? (object)fechaIngreso.Value.Date : DBNull.Value),
                new SqlParameter("@fecha_fin", fechaIngreso.HasValue ? (object)fechaIngreso.Value.Date : DBNull.Value)
            };

            // 🔥 lógica de rol

            int? idUbicacionFiltro = null;
            object idUsuarioParam = DBNull.Value;

            // Condicion cuando no sea admin ni valet (el valet ve todos los ingresos)
            if (rolUsuario != 3 && rolUsuario != 1)
            {

                idUsuarioParam = idUsuario;

            }

            // El admin puede ver los de un usuario (punto 10) y en qué paso participó: el mismo filtro de Despachos y
            // cobros (DondeParticipo). Va aparte del SP para no cambiar sp_consultarRegistros, como el filtro de turno
            HashSet<int>? participo = rolUsuario == 3 && usuarioFiltro.HasValue
                ? DondeParticipo(_context.ingresos.AsNoTracking(), usuarioFiltro.Value, como).Select(i => i.id_ingreso).ToHashSet()
                : null;

            parametros.Add(new SqlParameter("@id_usuario", idUsuarioParam));
            parametros.Add(new SqlParameter("@id_ubicacion", idUbicacionFiltro ?? (object)DBNull.Value));

            // Solo los ingresos de la zona que se ve (ZonaTabla: la de la sesión o la que escogió el admin; el banco,
            // además, solo los suyos)
            parametros.Add(new SqlParameter("@id_zona", (object?)idZona ?? DBNull.Value));

            // ✔ conversión a array (ESTO ES LO CLAVE)
            return _context.ingresos.FromSqlRaw(
                "EXEC sp_consultarRegistros @placa, @lugar, @estado_servicio, @estado_pago, @id_usuario, @parqueadero, @fecha_inicio, @fecha_fin, @id_ubicacion, @id_zona",
                parametros.ToArray()
            )
            .AsEnumerable()
            // Turno en que entró (filtro del admin): el SP ya trae id_turno, así no se cambia sp_consultarRegistros.
            // Los ingresos de antes de turnos.sql no tienen turno
            .Where(i => rolUsuario != 3 || !turno.HasValue || i.id_turno == turno)
            .Where(i => participo == null || participo.Contains(i.id_ingreso))
            // Arriba los solicitados, luego los despachados; en cada grupo, los más recientes primero
            .OrderByDescending(u => u.estado_servicio?.Trim().ToLower() == "solicitado")
            .ThenByDescending(u => u.estado_servicio?.Trim().ToLower() == "despachado")
            .ThenByDescending(u => u.fecha_ingreso)
            .ToList();
        }

        // Filas de la tabla de ingresos para el refresco automático (punto 16): las mismas de la página,
        // con sus filtros, armadas por la misma vista parcial (_FilasIngresos)
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult FilasIngresos(string? placa, string? lugar, string[]? estado_servicio, string? estado_pago, string? parqueadero, DateTime? fechaInicio, int? usuario, string? zona, int? turno, string? como)
        {
            // Sin sesión, OnActionExecuting ya redirige al login
            var idUsuario = HttpContext.Session.GetInt32("id");
            if (!idUsuario.HasValue)
            {
                return Unauthorized();
            }

            var estados = EstadosMarcados(estado_servicio, EstadosFiltro());
            var ingresos = IngresosTabla(idUsuario.Value, placa, lugar, estados, estado_pago, parqueadero, fechaInicio, usuario, ZonaTabla(zona), turno, como);
            ViewBag.NombresSolicitud = NombresSolicitud(ingresos);
            ViewBag.ValoresUbicacion = ValoresUbicacion();

            return PartialView("_FilasIngresos", ingresos);
        }

        // Estados del filtro de la tabla de ingresos y cuáles van marcados al entrar. Salen de
        // sp_estadosFiltroIngresos para cambiarlos en la BD sin publicar
        private List<estados_filtro_ingresos> EstadosFiltro() =>
            _context.Database.SqlQueryRaw<estados_filtro_ingresos>("EXEC sp_estadosFiltroIngresos").ToList();

        // Estados marcados en el filtro. Sin estados en la URL (al entrar, con Limpiar y en el refresco
        // de esa misma página) van los marcados por defecto, para no mezclar los finalizados
        private static string[] EstadosMarcados(string[]? estado_servicio, List<estados_filtro_ingresos> estadosFiltro)
        {
            var marcados = (estado_servicio ?? [])
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(e => e.Trim().ToLower())
                .Distinct()
                .ToArray();

            return marcados.Length > 0
                ? marcados
                : estadosFiltro.Where(e => e.por_defecto).Select(e => e.valor).ToArray();
        }

        // Zona del turno (Database/zonas.sql): cada operador la escoge al entrar y solo ve lo de ella.
        // Null en turnos abiertos antes de las zonas: entonces no se filtra
        private int? ZonaSesion() => HttpContext.Session.GetInt32("id_zona");

        // Zona de la tabla de ingresos: la de la sesión. El admin puede escoger otra (si existe) o "todas" (null =
        // sin filtrar); los demás roles siempre ven la suya, aunque manden otra en la URL
        private int? ZonaTabla(string? zona)
        {
            if (EsAdmin() && zona == "todas")
            {
                return null;
            }

            if (EsAdmin() && int.TryParse(zona, out var idZona) && _context.zonas.Any(z => z.id_zona == idZona))
            {
                return idZona;
            }

            return ZonaSesion();
        }

        // Turnos de los filtros (tabla de ingresos y Despachos y cobros), con el día en los que solo son un día
        // (Madrugada)
        private List<(int, string)> TurnosFiltro() => _context.turnos.AsNoTracking()
            .OrderBy(t => t.orden)
            .ToList()
            .Select(t => (t.id_turno, t.dia_semana is >= 1 and <= 7
                ? $"{t.nombre} ({DiasJornada[t.dia_semana.Value - 1]})"
                : t.nombre))
            .ToList();

        private string? NombreZona(int? idZona) => idZona.HasValue
            ? _context.zonas.Where(z => z.id_zona == idZona).Select(z => z.nombre_zona).FirstOrDefault()
            : null;

        // Ubicaciones y parqueaderos activos de una zona (los que aún no tienen zona salen en todas).
        // Salen de los SPs para poder ajustarlos desde la BD
        private List<ubicacion_servicios> UbicacionesZona(int? idZona) =>
            _context.ubicacion_servicios
                .FromSqlRaw("EXEC sp_ubicacionesServicio @id_zona", new SqlParameter("@id_zona", (object?)idZona ?? DBNull.Value))
                .AsNoTracking()
                .ToList();

        private List<parqueaderos> ParqueaderosZona(int? idZona) =>
            _context.parqueaderos
                .FromSqlRaw("EXEC sp_parqueaderos @id_zona", new SqlParameter("@id_zona", (object?)idZona ?? DBNull.Value))
                .AsNoTracking()
                .ToList();

        // Parqueadero principal de la zona: cada zona tiene uno, así que se escoge solo (Vista Key e ingreso de
        // vehículos). Si hay varios, el primero de la lista de sp_parqueaderos (activos, en orden alfabético), y los
        // que tienen la zona puesta antes que los que aún no tienen zona. null = la zona no tiene ninguno activo.
        // El login del Key hace lo mismo en auth.js (filtrarParqueaderosZona)
        private static parqueaderos? ParqueaderoPrincipal(IEnumerable<parqueaderos> parqueaderosZona) =>
            parqueaderosZona.OrderBy(p => p.id_zona == null).FirstOrDefault();

        // Ingresos de una zona. Los que todavía no la tienen guardada toman la de su ubicación
        private static IQueryable<ingresos> DeLaZona(IQueryable<ingresos> query, int? idZona) =>
            idZona.HasValue
                ? query.Where(i => i.id_zona == idZona || (i.id_zona == null && i.Ubicacion != null && i.Ubicacion.id_zona == idZona))
                : query;

        // Zona que llega de Configuraciones: solo si existe (vacía = sin zona)
        private int? ZonaValida(int? idZona) =>
            idZona.HasValue && _context.zonas.Any(z => z.id_zona == idZona) ? idZona : null;

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

        // La misma regla de ValetsDisponibles para otro rol: los de ese rol, quien tenga turno abierto con ese rol
        // (switch de rol) y el admin. Ordenados por nombre
        private List<usuarios> UsuariosDisponibles(int rol)
        {
            var enTurno = _context.sesiones
                .Where(s => s.fecha_fin == null && s.id_rol == rol)
                .Select(s => s.id_usuario);

            return _context.usuarios
                .Where(u => u.estado && (u.id_rol == rol || u.id_rol == 3 || enTurno.Contains(u.id_usuario)))
                .OrderBy(u => u.nombres)
                .ThenBy(u => u.apellidos)
                .ToList();
        }

        // Quienes pueden haber parqueado un vehículo: los valets y los Key (VistaKey)
        private List<usuarios> Parqueadores() => ValetsDisponibles()
            .UnionBy(UsuariosDisponibles(4), u => u.id_usuario)
            .OrderBy(u => u.nombres)
            .ThenBy(u => u.apellidos)
            .ToList();

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
        public async Task<IActionResult> IngresoVehiculos(ingresos obj_ingreso, int? id_valet, int id_banco, string? firmaBase64, bool sin_objetos_valor = false, List<string>? fotos = null, string? videoBase64 = null, IFormFile? video = null, string? indicativo = null)
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

            // WhatsApp de otro país (selector de indicativo): con + y el indicativo para que le llegue el mensaje
            var telefonoPais = TelefonoConIndicativo(obj_ingreso.telefono, indicativo);

            if (telefonoPais == null)
            {
                ViewBag.Error = "El WhatsApp no es válido: escribe solo el número, o con + y el indicativo si escogiste Otro país.";
                return View("Ingreso_Vehiculos");
            }

            obj_ingreso.telefono = telefonoPais;

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

                // Ubicación: viene del formulario para todos (campo obligatorio), activa y de la zona en la que
                // entró (o sin zona todavía). El turno se queda en la zona aunque cambie de restaurante
                var zonaSesion = ZonaSesion();
                var ubicacionIngreso = obj_ingreso.id_ubicacion > 0
                    ? _context.ubicacion_servicios.AsNoTracking()
                        .FirstOrDefault(u => u.id_ubicacion == obj_ingreso.id_ubicacion && u.estado == "activo")
                    : null;

                if (ubicacionIngreso == null ||
                    (zonaSesion.HasValue && ubicacionIngreso.id_zona.HasValue && ubicacionIngreso.id_zona != zonaSesion))
                {
                    ViewBag.Error = "Selecciona una ubicación válida.";
                    CargarDatosFormulario();
                    return View("Ingreso_Vehiculos");
                }

                // El ingreso guarda su zona: la de la ubicación o, si aún no tiene, la del turno
                obj_ingreso.id_zona = ubicacionIngreso.id_zona ?? zonaSesion;


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

                // Turno en que entró (Database/turnos.sql): el del banco que lo registra; si quien lo registra no
                // tiene turno (el admin), el de la hora
                obj_ingreso.id_turno = sesionUsuario?.id_turno ?? Turnos.DeLaHora(_context, DateTime.Now)?.id_turno;

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


                // Guardar el video si existe. Llega como archivo; el navegador que no puede mandarlo así
                // lo manda en base64 como antes
                byte[]? datoVideo = null;

                if (video != null && video.Length > 0)
                {
                    using var memoria = new MemoryStream();
                    await video.CopyToAsync(memoria);
                    datoVideo = memoria.ToArray();
                }
                else if (!string.IsNullOrEmpty(videoBase64))
                {
                    var base64Data = videoBase64.Contains(",") ? videoBase64.Split(',')[1] : videoBase64;
                    datoVideo = Convert.FromBase64String(base64Data);
                }

                if (datoVideo != null)
                {
                    var videoImagen = new imagenes
                    {
                        id_ingreso = obj_ingreso.id_ingreso,
                        dato_imagen = datoVideo
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
        // Colombia (57, o sin indicativo: formularios de antes) queda como lo escribieron, igual que siempre. Otro
        // país: + indicativo + número (máximo 15 dígitos en total). "otro": el número ya trae + y el indicativo.
        // null = no es válido
        private static string? TelefonoConIndicativo(string? telefono, string? indicativo)
        {
            if (string.IsNullOrWhiteSpace(indicativo) || indicativo == "57")
            {
                return telefono;
            }

            var numero = System.Text.RegularExpressions.Regex.Replace(telefono ?? "", @"[\s\-()]", "");

            if (indicativo == "otro")
            {
                return System.Text.RegularExpressions.Regex.IsMatch(numero, @"^\+[0-9]{8,15}$") ? numero : null;
            }

            var completo = indicativo + numero;

            return System.Text.RegularExpressions.Regex.IsMatch(indicativo, @"^[0-9]{1,3}$") &&
                   System.Text.RegularExpressions.Regex.IsMatch(numero, @"^[0-9]{4,14}$") &&
                   completo.Length <= 15
                ? "+" + completo
                : null;
        }

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

        // Liquidaciones (solo administrador): todas, o las de un usuario y un rango de fechas. Los filtros se
        // aplican solos (FilasLiquidaciones); los vehículos de cada una se piden al abrirla (DetalleLiquidacion)
        [HttpGet]
        public IActionResult Liquidaciones(int? usuario, DateTime? desde, DateTime? hasta)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return RedirectToAction("Index");
            }

            // Todos los usuarios, no solo los que ya liquidaron: cualquiera puede llegar a cobrar.
            // Mismo procedimiento que la tabla de usuarios del administrador, sin filtros
            var sinFiltros = new[] { "@nombre", "@apellido", "@documento", "@edad", "@rol", "@estado" }
                .Select(nombre => new SqlParameter(nombre, DBNull.Value))
                .ToArray();

            ViewBag.UsuariosFiltro = _context.usuarios
                .FromSqlRaw("EXEC sp_consultarUsuarios @nombre, @apellido, @documento, @edad, @rol, @estado", sinFiltros)
                .AsEnumerable()
                .OrderBy(u => u.nombres)
                .ThenBy(u => u.apellidos)
                .ToList();

            ViewData["FiltroUsuario"] = usuario;
            ViewData["FiltroDesde"] = desde;
            ViewData["FiltroHasta"] = hasta;

            return View(ConsultarLiquidaciones(usuario, desde, hasta));
        }

        // Filas de Liquidaciones con los filtros elegidos, para cambiarlas sin recargar la página
        // (activarFiltrosAutomaticos, site.js). Las arma la misma vista parcial que la página
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult FilasLiquidaciones(int? usuario, DateTime? desde, DateTime? hasta)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return Unauthorized();
            }

            return PartialView("_FilasLiquidaciones", ConsultarLiquidaciones(usuario, desde, hasta));
        }

        // sp_consultarLiquidaciones (Database/liquidaciones-admin.sql); cada filtro es opcional
        private List<liquidacion_consulta> ConsultarLiquidaciones(int? usuario, DateTime? desde, DateTime? hasta) =>
            _context.Database
                .SqlQueryRaw<liquidacion_consulta>("EXEC sp_consultarLiquidaciones @id_usuario, @fecha_inicio, @fecha_fin",
                    new SqlParameter("@id_usuario", (object?)usuario ?? DBNull.Value),
                    new SqlParameter("@fecha_inicio", System.Data.SqlDbType.Date) { Value = (object?)desde?.Date ?? DBNull.Value },
                    new SqlParameter("@fecha_fin", System.Data.SqlDbType.Date) { Value = (object?)hasta?.Date ?? DBNull.Value })
                .ToList();

        // Filtro "Cómo participó" (Despachos y cobros y tabla de ingresos): los vehículos en los que el usuario hizo
        // ese paso, o cualquiera si no se escoge
        private static IQueryable<ingresos> DondeParticipo(IQueryable<ingresos> consulta, int u, string? como) => como switch
        {
            "ingreso" => consulta.Where(i => i.id_banco == u),
            "recibio" => consulta.Where(i => i.id_valet == u),
            "parqueo" => consulta.Where(i => i.usuario_parqueo == u),
            "solicito" => consulta.Where(i => i.usuario_solicitud == u),
            "despacho" => consulta.Where(i => i.valet_despacho == u),
            "cobro" => consulta.Where(i => i.usuario_cobro == u),
            "liquido" => consulta.Where(i => i.Liquidacion != null && i.Liquidacion.id_usuario == u),
            _ => consulta.Where(i => i.id_banco == u || i.id_valet == u || i.usuario_parqueo == u ||
                                     i.usuario_solicitud == u || i.valet_despacho == u || i.usuario_cobro == u ||
                                     (i.Liquidacion != null && i.Liquidacion.id_usuario == u))
        };

        // Opciones del filtro "Cómo participó" (las mismas en las dos vistas)
        public static readonly (string valor, string texto)[] OpcionesComoParticipo =
        [
            ("", "En cualquier paso"), ("ingreso", "Registró el ingreso"), ("recibio", "Recibió (valet)"),
            ("parqueo", "Parqueó"), ("solicito", "Solicitó"), ("despacho", "Despachó"),
            ("cobro", "Cobró"), ("liquido", "Liquidó")
        ];

        // Despachos y cobros (punto 28, solo administrador): cada vehículo que ingresó en el período (solo la fecha
        // de ingreso, la que se ve en la fila), con quién lo recibió, quién lo solicitó, quién lo despachó, quién lo cobró y su liquidación
        [HttpGet]
        public IActionResult DespachosCobros(DateTime? desde, DateTime? hasta, string? placa, int? usuario, string? como, int? zona, int? turno, string? estado, int pagina = 1)
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
                .Include(i => i.Parqueadero)
                .Where(i => i.fecha_ingreso >= fechaDesde && i.fecha_ingreso < fechaHasta);

            if (!string.IsNullOrWhiteSpace(placa))
            {
                var placaFiltro = placa.Trim().ToUpper();
                consulta = consulta.Where(i => i.placa != null && i.placa.Contains(placaFiltro));
            }

            // Usuario: los vehículos en los que participó, en el papel escogido o en cualquiera. El resumen de
            // arriba se calcula con estos (con "cobró", lo que cobró esa persona; con "liquidó", lo que liquidó)
            if (usuario.HasValue)
            {
                consulta = DondeParticipo(consulta, usuario.Value, como);
            }

            // Zona del ingreso (los que no la tienen guardada, la de su ubicación) y turno en que entró (punto 10).
            // Los ingresos de antes de turnos.sql no tienen turno: con ese filtro no salen
            if (zona.HasValue)
            {
                consulta = DeLaZona(consulta, zona);
            }

            if (turno.HasValue)
            {
                consulta = consulta.Where(i => i.id_turno == turno);
            }

            // Estado del cobro: liquidado es lo mismo que Liquidado() (con id de liquidación o marcado), escrito aquí
            // para que EF lo pase a SQL
            consulta = estado switch
            {
                "cobrados" => consulta.Where(i => i.estado_pago == "pagado"),
                "sin-liquidar" => consulta.Where(i => i.estado_pago == "pagado" && i.id_liquidacion == null && i.estado_liquidacion != true),
                "liquidados" => consulta.Where(i => i.id_liquidacion != null || i.estado_liquidacion == true),
                _ => consulta
            };

            // Todos los del filtro para el resumen y el total pagado; en la tabla, de a 50 (páginas). El id desempata
            // para que un vehículo no salte de página
            var todos = consulta
                .OrderByDescending(i => i.fecha_ingreso)
                .ThenByDescending(i => i.id_ingreso)
                .ToList();

            const int porPagina = 50;
            var totalPaginas = Math.Max(1, (todos.Count + porPagina - 1) / porPagina);
            pagina = Math.Clamp(pagina, 1, totalPaginas);

            var ingresos = todos.Skip((pagina - 1) * porPagina).Take(porPagina).ToList();

            ViewBag.Pagina = pagina;
            ViewBag.TotalPaginas = totalPaginas;

            // Historial de cambios de cada vehículo (punto 6): la columna Modificó y la ventana de información
            ViewBag.Cambios = CambiosIngresos(ingresos.Select(i => i.id_ingreso))
                .GroupBy(c => c.id_ingreso)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Nombres de todos los que aparecen: valet que recibió, quien parqueó, quien solicitó, valet de despacho
            // y quien cobró; y el banco que registró el ingreso (ventana de información)
            var idsUsuarios = ingresos
                .SelectMany(i => new int?[] { i.id_valet, i.usuario_parqueo, i.usuario_solicitud, i.valet_despacho, i.usuario_cobro, i.id_banco })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            ViewBag.Nombres = _context.usuarios
                .Where(u => idsUsuarios.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);

            // Resumen del período con las mismas cuentas de la liquidación (LiquidacionReglas.Calcular): transferencias
            // con propinas, propinas de QR, efectivo a entregar y total (vehículos × servicio). Son los mismos vehículos
            // de la lista (todas las páginas): uno que ingresó hoy y se cobra mañana cuenta en el resumen de hoy
            var cobrados = todos.Where(i => i.estado_pago == "pagado").ToList();

            ViewBag.Vehiculos = todos.Count;
            ViewBag.Despachados = todos.Count(i => i.valet_despacho.HasValue);
            ViewBag.Cobrados = cobrados.Count;
            ViewBag.Cuentas = LiquidacionReglas.Calcular(cobrados);
            ViewBag.SinLiquidar = cobrados.Count(i => i.estado_liquidacion != true);

            // Total de la columna Cobro: lo que pagaron los clientes, con propinas (en efectivo nunca hay propina)
            ViewBag.TotalPagado = cobrados.Sum(LiquidacionReglas.Cobrado);
            ViewBag.TotalPropinas = cobrados.Where(i => !LiquidacionReglas.EsEfectivo(i)).Sum(i => i.valor_propina ?? 0);

            // Usuarios del filtro, en orden alfabético (punto 15)
            ViewBag.UsuariosFiltro = _context.usuarios.AsNoTracking()
                .OrderBy(x => x.nombres).ThenBy(x => x.apellidos)
                .ToList();

            // Zonas (las mismas del login) y turnos
            ViewBag.ZonasFiltro = _context.zonas.FromSqlRaw("EXEC sp_zonas").AsNoTracking().ToList();
            ViewBag.TurnosFiltro = TurnosFiltro();

            ViewData["FiltroDesde"] = fechaDesde;
            ViewData["FiltroHasta"] = fechaHasta.AddDays(-1);
            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroUsuario"] = usuario;
            ViewData["FiltroComo"] = como;
            ViewData["FiltroZona"] = zona;
            ViewData["FiltroTurno"] = turno;
            ViewData["FiltroEstado"] = estado;

            return View(ingresos);
        }

        // Día de la jornada de un turno (tbl_turnos.dia_semana: 1 = lunes ... 7 = domingo)
        private static readonly string[] DiasJornada = { "lun", "mar", "mié", "jue", "vie", "sáb", "dom" };

        // =========================== Historial de cambios (Database/ajustes-admin.sql) =========================== \\

        // Registra un cambio en el historial con quien tiene la sesión. Se llama dentro de la transacción del cambio
        private void RegistrarCambio(int idIngreso, string campo, string? antes, string? despues, string? motivo = null)
        {
            _context.Database.ExecuteSqlRaw(
                "EXEC sp_registrarCambioIngreso @id_ingreso, @id_usuario, @campo, @antes, @despues, @motivo, @ahora",
                new SqlParameter("@id_ingreso", idIngreso),
                new SqlParameter("@id_usuario", HttpContext.Session.GetInt32("id")!.Value),
                new SqlParameter("@campo", campo),
                new SqlParameter("@antes", System.Data.SqlDbType.NVarChar, 150) { Value = (object?)Recortar(antes, 150) ?? DBNull.Value },
                new SqlParameter("@despues", System.Data.SqlDbType.NVarChar, 150) { Value = (object?)Recortar(despues, 150) ?? DBNull.Value },
                new SqlParameter("@motivo", System.Data.SqlDbType.NVarChar, 250) { Value = (object?)Recortar(motivo, 250) ?? DBNull.Value },
                new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now });
        }

        private static string? Recortar(string? texto, int largo) =>
            texto == null || texto.Length <= largo ? texto : texto[..largo];

        // Historial de varios vehículos, el más reciente primero
        private List<cambio_ingreso> CambiosIngresos(IEnumerable<int> idsIngresos)
        {
            var ids = string.Join(",", idsIngresos);

            return ids.Length == 0
                ? new List<cambio_ingreso>()
                : _context.Database
                    .SqlQueryRaw<cambio_ingreso>("EXEC sp_cambiosIngresos @ids",
                        new SqlParameter("@ids", System.Data.SqlDbType.VarChar, -1) { Value = ids })
                    .ToList();
        }

        // Un cambio como lo muestran las ventanas de información
        private static object CambioParaVista(cambio_ingreso c) => new
        {
            fecha = c.fecha.ToString("dd/MM HH:mm"),
            quien = string.IsNullOrWhiteSpace(c.usuario) ? "—" : c.usuario,
            que = c.Que,
            c.antes,
            c.despues,
            c.motivo
        };

        // Ejecuta un SP de cambio del admin (sp_cancelarServicio, sp_cambiarLugar..., sp_cambiarComprobante), que
        // valida, guarda y deja el historial en una sola transacción. Devuelve si cambió algo
        private bool EjecutarCambio(string sql, params SqlParameter[] parametros) =>
            _context.Database.SqlQueryRaw<bool>(sql, parametros).AsEnumerable().FirstOrDefault();

        private static string Pesos(decimal? valor) =>
            (valor ?? 0).ToString("C0", System.Globalization.CultureInfo.GetCultureInfo("es-CO"));

        private static readonly string[] MetodosPagoAdmin = { "Efectivo", "QR", "Transferencia", "Nequi" };

        // Despachos y cobros > Información: el administrador corrige el método de pago o el valor total de un
        // vehículo ya cobrado (uno de los dos por vez). Si ya está en una liquidación no se cambia: sus totales
        // quedarían descuadrados. Mismas reglas que el cobro del banco (FinalizarServicio): en efectivo no hay
        // propina y el valor no se cambia; con QR o transferencia el servicio queda en la tarifa y lo de más es propina
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult EditarCobro(int id_ingreso, string? metodo_pago, decimal? valor_total)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cambiar un cobro." });
            }

            var ingreso = _context.ingresos.Include(i => i.Ubicacion).FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (ingreso.estado_pago != "pagado")
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} todavía no se ha cobrado." });
            }

            if (ingreso.id_liquidacion.HasValue || ingreso.estado_liquidacion == true)
            {
                var liquidacion = ingreso.id_liquidacion.HasValue ? $"en la liquidación #{ingreso.id_liquidacion}" : "liquidado";
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya está {liquidacion}: no se puede cambiar." });
            }

            // Cómo estaba, para el historial de cambios (punto 6)
            var metodoAntes = ingreso.metodo_pago ?? "Sin método";
            var totalAntes = TotalCobrado(ingreso);

            if (metodo_pago != null)
            {
                if (!MetodosPagoAdmin.Contains(metodo_pago))
                {
                    return Json(new { success = false, mensaje = "Elige un método de pago válido." });
                }

                ingreso.metodo_pago = metodo_pago;

                // Pasado a efectivo: queda el servicio, sin propina
                if (metodo_pago == "Efectivo")
                {
                    ingreso.valor_propina = 0;
                    ingreso.total_servicio = ingreso.valor_servicio;
                }
            }
            else if (valor_total.HasValue)
            {
                if (ingreso.metodo_pago == "Efectivo")
                {
                    return Json(new { success = false, mensaje = "En efectivo el valor es la tarifa y no se cambia. Si pagó por QR o transferencia, cambia primero el método." });
                }

                var total = valor_total.Value;

                // Menos de $1.000 casi siempre es "20.000" mal escrito (quedaba en 20)
                if (total < 1000 || total > 10_000_000 || total != decimal.Truncate(total))
                {
                    return Json(new { success = false, mensaje = "El valor total debe ser el valor completo en pesos, de $1.000 en adelante (por ejemplo 20000)." });
                }

                // El servicio no cambia (la tarifa con la que se cobró); si no tenía, el de la ubicación
                var servicio = (ingreso.valor_servicio ?? 0) > 0
                    ? ingreso.valor_servicio!.Value
                    : ingreso.Ubicacion?.valor_servicio ?? 0;

                ingreso.valor_servicio = servicio;
                ingreso.valor_propina = Math.Max(0, total - servicio);
                ingreso.total_servicio = total;
            }
            else
            {
                return Json(new { success = false, mensaje = "No hay nada que cambiar." });
            }

            // El cambio y su registro en el historial se guardan juntos: o queda todo o nada
            var (campo, antes, despues) = metodo_pago != null
                ? ("metodo_pago", $"{metodoAntes} · {Pesos(totalAntes)}", $"{metodo_pago} · {Pesos(TotalCobrado(ingreso))}")
                : ("valor_total", Pesos(totalAntes), Pesos(TotalCobrado(ingreso)));

            using (var transaccion = _context.Database.BeginTransaction())
            {
                _context.SaveChanges();

                if (antes != despues)
                {
                    RegistrarCambio(ingreso.id_ingreso, campo, antes, despues);
                }

                transaccion.Commit();
            }

            return Json(new { success = true, mensaje = $"Cobro del vehículo {ingreso.placa} actualizado." });
        }

        // Lo que pagó el cliente con propina (cobros de antes sin total: servicio + propina), como en Despachos y cobros
        private static decimal TotalCobrado(ingresos i) =>
            (i.total_servicio ?? 0) > 0 ? i.total_servicio!.Value : (i.valor_servicio ?? 0) + (i.valor_propina ?? 0);

        // Foto del comprobante real de un cobro (punto 7, Despachos y cobros): solo el admin, con QR, transferencia o
        // Nequi y sin liquidar (la misma regla del lápiz de método y valor). sp_cambiarComprobante vuelve a validar,
        // reemplaza la foto y deja el registro en el historial
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CambiarComprobante(int id_ingreso, string? fotoBase64)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cambiar el comprobante." });
            }

            var ingreso = _context.ingresos.AsNoTracking().FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (ingreso.estado_pago != "pagado" || !MetodosConComprobante.Contains(ingreso.metodo_pago ?? ""))
            {
                return Json(new { success = false, mensaje = "La foto del comprobante es solo para cobros por QR, transferencia o Nequi." });
            }

            if (Liquidado(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya está liquidado: el comprobante no se cambia." });
            }

            byte[] foto;
            try
            {
                foto = Convert.FromBase64String(fotoBase64?.Contains(',') == true ? fotoBase64.Split(',')[1] : fotoBase64 ?? "");
            }
            catch (FormatException)
            {
                return Json(new { success = false, mensaje = "La imagen recibida no tiene un formato válido." });
            }

            // JPEG (FF D8 FF): la foto ya llega achicada desde el navegador (despachos-cobros.js)
            if (foto.Length < 4 || foto[0] != 0xFF || foto[1] != 0xD8 || foto[2] != 0xFF)
            {
                return Json(new { success = false, mensaje = "Toma la foto del comprobante antes de guardar." });
            }

            var guardada = EjecutarCambio("EXEC sp_cambiarComprobante @id_ingreso, @id_usuario, @foto, @ahora",
                new SqlParameter("@id_ingreso", id_ingreso),
                new SqlParameter("@id_usuario", HttpContext.Session.GetInt32("id")!.Value),
                new SqlParameter("@foto", System.Data.SqlDbType.VarBinary, -1) { Value = foto },
                new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now });

            return Json(guardada
                ? new { success = true, mensaje = $"Comprobante de {ingreso.placa} guardado." }
                : new { success = false, mensaje = $"No se pudo guardar: el cobro de {ingreso.placa} cambió. Recarga la página." });
        }

        private static readonly string[] MetodosConComprobante = { "QR", "Transferencia", "Nequi" };

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
            // Parqueaderos y ubicaciones: solo los de la zona en la que entró. El parqueadero sale escogido: el principal
            var parqueaderosZona = ParqueaderosZona(ZonaSesion());
            ViewBag.Parqueaderos = parqueaderosZona;
            ViewBag.ParqueaderoPrincipal = ParqueaderoPrincipal(parqueaderosZona)?.id_parqueadero;
            ViewBag.UbicacionesS = UbicacionesZona(ZonaSesion());

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

                // Cobran el banco y el admin. El valet ya no cobra: solo toma la foto de la transferencia (fotoTransferencia)
                if (rolUsuario is not (2 or 3))
                {
                    return Json(new
                    {
                        success = false,
                        message = "Solo el banco o el administrador pueden cobrar."
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

                // Si el método de pago es transferencia o QR, la foto es obligatoria: la nueva que manden
                // o, si no mandan, la que ya tomó el valet
                if (ingreso.metodo_pago == "Transferencia" || ingreso.metodo_pago == "QR")
                {
                    if (string.IsNullOrWhiteSpace(dto.FotoBase64) && ingreso.foto_transferencia == null)
                    {
                        return Json(new
                        {
                            success = false,
                            message = "Debe tomar la foto de la transferencia."
                        });
                    }

                    if (!string.IsNullOrWhiteSpace(dto.FotoBase64))
                    {
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
                }

                // Efectivo: siempre la tarifa, sin propina (la propina en efectivo no se registra: va directo al valet),
                // aunque llegue otro valor. El método es el que quedó al generar el código (GenerarCodigoSeguridad)
                var esEfectivo = ingreso.metodo_pago == "Efectivo";

                // QR o transferencia: lo que el cliente pagó de verdad, con propina. Es obligatorio: el banco lo escribe
                // del comprobante (el campo arranca vacío)
                var valorCobrado = !esEfectivo && dto.ValorCobrado.HasValue
                    ? decimal.Round(dto.ValorCobrado.Value, 0)
                    : (decimal?)null;

                if (!esEfectivo && !valorCobrado.HasValue)
                {
                    return Json(new { success = false, message = "Escribe el valor que pagó el cliente." });
                }

                // Menos de $1.000 casi siempre es "20.000" mal escrito (quedaba en 20): se pide el valor completo
                if (valorCobrado < 1000)
                {
                    return Json(new
                    {
                        success = false,
                        message = "El valor cobrado parece incompleto: escribe el valor completo (por ejemplo 20000)."
                    });
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

                // El servicio queda siempre en la tarifa (la liquidación es vehículos × servicio). Lo que pase del
                // servicio es propina; si pagó menos, queda en total_servicio y la liquidación lo muestra como diferencia
                if (esEfectivo)
                {
                    ingreso.valor_propina = 0;
                    ingreso.total_servicio = ingreso.valor_servicio;
                }
                else if (valorCobrado.HasValue)
                {
                    var cobrado = valorCobrado.Value;
                    var servicio = ingreso.valor_servicio ?? 0;

                    ingreso.valor_propina = Math.Max(0, cobrado - servicio);
                    ingreso.total_servicio = cobrado;
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
            // Solo el administrador: sin esto, cualquiera con sesión podía editar usuarios enviando el formulario
            if (!EsAdmin())
            {
                return RedirectToAction("Index");
            }

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
                var fotoAnterior = usuario.imagen_usuario;
                var fotoNoGuardada = false;
                if (!string.IsNullOrWhiteSpace(avatarBase64))
                {
                    var foto = GuardarFotoUsuario(id_usuario, avatarBase64);
                    fotoNoGuardada = foto == null;
                    usuario.imagen_usuario = foto ?? usuario.imagen_usuario;
                }

                _context.SaveChanges();

                if (usuario.imagen_usuario != fotoAnterior)
                {
                    BorrarFotoAnterior(id_usuario, fotoAnterior);
                }

                if (fotoNoGuardada)
                {
                    TempData["Error"] = "Los datos se guardaron, pero la foto no: elige otra imagen.";
                }

                // La foto del menú es la de quien tiene la sesión: solo cambia si el admin se editó a sí mismo
                // (antes le quedaba la foto del usuario que editaba)
                if (id_usuario == HttpContext.Session.GetInt32("id") && !string.IsNullOrEmpty(usuario.imagen_usuario))
                {
                    HttpContext.Session.SetString("imagen_usuario_url", usuario.imagen_usuario);
                }

                TempData["Mensaje"] = "Los datos del usuario se actualizaron correctamente.";
            }
            return RedirectToAction("Administrador");
        }

        private bool EsAdmin() => HttpContext.Session.GetInt32("id_rol") == 3;

        // Fotos de usuario: un solo archivo por usuario, wwwroot/uploads/usuarios/usuario_{id}.jpg, que la foto
        // nueva reemplaza (no se acumulan). La ruta lleva ?v= para que el navegador no muestre la anterior, y las
        // rutas viejas siguen sirviendo: nadie queda con la foto rota. La usan Editar usuario (admin) y Mi perfil
        private static string CarpetaFotosUsuario() =>
            Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "usuarios");

        // Guarda la foto (JPEG en base64, ya achicada en el navegador por perfil.js) y devuelve su ruta;
        // null si no es un JPEG o no se pudo guardar
        private string? GuardarFotoUsuario(int idUsuario, string avatarBase64)
        {
            try
            {
                var bytes = Convert.FromBase64String(avatarBase64.Contains(",") ? avatarBase64.Split(',')[1] : avatarBase64);

                // JPEG: empieza con FF D8 FF
                if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 || bytes[2] != 0xFF)
                {
                    return null;
                }

                Directory.CreateDirectory(CarpetaFotosUsuario());   // si ya existe no hace nada
                System.IO.File.WriteAllBytes(Path.Combine(CarpetaFotosUsuario(), $"usuario_{idUsuario}.jpg"), bytes);

                return $"/uploads/usuarios/usuario_{idUsuario}.jpg?v={DateTime.Now:yyyyMMddHHmmss}";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error al guardar imagen: {ex.Message}");
                return null;
            }
        }

        // Antes cada foto tenía la fecha en el nombre (usuario_{id}_fecha.jpg) y se iban acumulando: se borra la que
        // tenía el usuario. Se llama después de guardar en la base, para no dejarla apuntando a un archivo borrado
        private void BorrarFotoAnterior(int idUsuario, string? fotoAnterior)
        {
            if (fotoAnterior == null || !fotoAnterior.StartsWith("/uploads/usuarios/")) return;

            // Solo el nombre (sin carpetas ni ?v=) y solo si es de este usuario con el nombre de antes
            var nombre = Path.GetFileName(fotoAnterior.Split('?')[0]);
            if (!nombre.StartsWith($"usuario_{idUsuario}_")) return;

            try
            {
                System.IO.File.Delete(Path.Combine(CarpetaFotosUsuario(), nombre));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"No se pudo borrar la foto anterior {nombre}: {ex.Message}");
            }
        }

        // Reglas de una contraseña nueva (las mismas revisa perfil.js antes de enviar): null si está bien
        private static string? ErrorContrasena(string? nueva, string? confirmar)
        {
            if (string.IsNullOrEmpty(nueva)) return "Escribe la nueva contraseña.";
            if (nueva.Length < 6) return "La contraseña debe tener al menos 6 caracteres.";
            if (nueva.Length > 50) return "La contraseña puede tener máximo 50 caracteres.";
            if (nueva != nueva.Trim()) return "La contraseña no puede empezar ni terminar con espacios.";
            if (nueva != confirmar) return "La confirmación no coincide con la contraseña.";
            return null;
        }

        // Contraseña de un usuario para el ojo de "Editar usuario" (solo administrador). No va escrita en la
        // página: se pide solo cuando el admin toca el ojo
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ContrasenaUsuario(int id)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "No tienes permiso para ver contraseñas." });
            }

            var usuario = _context.usuarios.AsNoTracking()
                .Where(u => u.id_usuario == id)
                .Select(u => new { u.contraseña })
                .FirstOrDefault();

            return usuario == null
                ? Json(new { success = false, mensaje = "No se encontró el usuario." })
                : Json(new { success = true, contrasena = usuario.contraseña ?? "" });
        }

        // El administrador le pone una contraseña nueva a un usuario (Editar usuario, con dos toques)
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CambiarContrasenaUsuario(int id_usuario, string? nueva, string? confirmar)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cambiar la contraseña de otro usuario." });
            }

            var error = ErrorContrasena(nueva, confirmar);
            if (error != null)
            {
                return Json(new { success = false, mensaje = error });
            }

            var usuario = _context.usuarios.FirstOrDefault(u => u.id_usuario == id_usuario);
            if (usuario == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el usuario." });
            }

            usuario.contraseña = nueva;
            _context.SaveChanges();

            return Json(new { success = true, mensaje = $"Contraseña de {usuario.nombres} {usuario.apellidos} cambiada." });
        }

        // =========================== Mi perfil =========================== \\

        // Mi perfil (todos los roles): sus datos, y cambiar correo, teléfono, foto y contraseña.
        // Siempre el usuario de la sesión, nunca uno que llegue en el formulario
        [HttpGet]
        public IActionResult MiPerfil()
        {
            var usuario = _context.usuarios.AsNoTracking()
                .FirstOrDefault(u => u.id_usuario == HttpContext.Session.GetInt32("id"));

            return usuario == null ? RedirectToAction("Login", "Auth") : VistaPerfil(usuario);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult MiPerfil(string? correo, string? telefono, string? avatarBase64)
        {
            var usuario = _context.usuarios.FirstOrDefault(u => u.id_usuario == HttpContext.Session.GetInt32("id"));
            if (usuario == null)
            {
                return RedirectToAction("Login", "Auth");
            }

            correo = correo?.Trim() ?? "";
            // Solo números; al escribirlo se aceptan espacios, guiones y paréntesis
            telefono = System.Text.RegularExpressions.Regex.Replace(telefono ?? "", @"[\s\-()]", "");

            string? error = null;
            if (correo.Length == 0 || correo.Length > 100 || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(correo))
            {
                error = "Escribe un correo válido.";
            }
            else if (_context.usuarios.Any(u => u.correo != null && u.correo.Trim().ToLower() == correo.ToLower() &&
                                                u.id_usuario != usuario.id_usuario && u.estado))
            {
                error = $"El correo '{correo}' ya está en uso por otro usuario.";
            }
            else if (!System.Text.RegularExpressions.Regex.IsMatch(telefono, @"^[0-9]{7,15}$"))
            {
                error = "Escribe un teléfono de 7 a 15 números.";
            }

            // La foto llega achicada en JPEG (perfil.js): cualquier otra cosa no se guarda
            string? foto = null;
            if (error == null && !string.IsNullOrWhiteSpace(avatarBase64))
            {
                foto = GuardarFotoUsuario(usuario.id_usuario, avatarBase64);
                if (foto == null)
                {
                    error = "No se pudo guardar la foto. Elige otra imagen.";
                }
            }

            if (error != null)
            {
                // Se muestra lo que escribió, sin guardarlo
                usuario.correo = correo;
                usuario.telefono = telefono;
                ViewBag.Error = error;
                return VistaPerfil(usuario);
            }

            var fotoAnterior = usuario.imagen_usuario;
            usuario.correo = correo;
            usuario.telefono = telefono;
            if (foto != null)
            {
                usuario.imagen_usuario = foto;
                HttpContext.Session.SetString("imagen_usuario_url", foto);   // la foto del menú
            }

            _context.SaveChanges();

            if (foto != null)
            {
                BorrarFotoAnterior(usuario.id_usuario, fotoAnterior);
            }

            TempData["PerfilExito"] = "Tus datos se guardaron.";
            return RedirectToAction("MiPerfil");
        }

        // Cambiar la contraseña propia: pide la actual, así nadie la cambia con un celular que quedó con la sesión abierta
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CambiarMiContrasena(string? actual, string? nueva, string? confirmar)
        {
            var usuario = _context.usuarios.FirstOrDefault(u => u.id_usuario == HttpContext.Session.GetInt32("id"));
            if (usuario == null)
            {
                return Json(new { success = false, mensaje = "Tu sesión terminó. Vuelve a entrar." });
            }

            if (string.IsNullOrEmpty(actual) || actual != usuario.contraseña)
            {
                return Json(new { success = false, mensaje = "La contraseña actual no es correcta." });
            }

            var error = ErrorContrasena(nueva, confirmar) ??
                        (nueva == actual ? "La nueva contraseña debe ser distinta de la actual." : null);
            if (error != null)
            {
                return Json(new { success = false, mensaje = error });
            }

            usuario.contraseña = nueva;
            _context.SaveChanges();

            return Json(new { success = true, mensaje = "Tu contraseña se cambió. Úsala la próxima vez que entres." });
        }

        private IActionResult VistaPerfil(usuarios usuario)
        {
            ViewBag.Rol = _context.roles.AsNoTracking()
                .Where(r => r.id_rol == usuario.id_rol)
                .Select(r => r.nombre_rol)
                .FirstOrDefault() ?? "—";

            // El Key vuelve a su vista de parqueaderos; los demás, al inicio
            ViewBag.Volver = usuario.id_rol == 4 ? "VistaKey" : "Index";

            return View("MiPerfil", usuario);
        }

        // =========================== Ubicacion =========================== \\

        // Tarifas: 0 (gratis) o el valor completo. Entre 1 y 999 casi siempre es "20.000" mal escrito: con el campo
        // numérico de antes el navegador tomaba el punto como decimal y la tarifa de OCIO quedó en 20
        private static bool TarifaIncompleta(decimal valor) => valor != 0 && valor < 1000;

        private const string MensajeTarifaIncompleta =
            "La tarifa parece incompleta: escribe el valor completo (por ejemplo 20000) o 0 si es gratis.";

        // Acción para registrar una nueva ubicación
        [HttpPost]
        public IActionResult RegistrarUbicacion(string nombre_ubicacion, string direccion, string ciudad, decimal valor_servicio, int? id_zona)
        {
            if (TarifaIncompleta(valor_servicio))
            {
                TempData["Error"] = MensajeTarifaIncompleta;
                return RedirectToAction("Administrador");
            }

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
                    valor_servicio = valor_servicio,
                    id_zona = ZonaValida(id_zona)
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
        public IActionResult EditarUbicacion(int id_ubicacion, string? nombre_ubicacion, string? direccion, string? ciudad, decimal valor_servicio, int? id_zona)
        {
            if (TarifaIncompleta(valor_servicio))
            {
                TempData["Error"] = MensajeTarifaIncompleta;
                return RedirectToAction("Administrador");
            }

            // Dirección y ciudad pueden quedar vacías: PUENTE y BELISARIO se crearon sin ellas (zonas.sql) y al
            // cambiarles solo el valor se caía en direccion.Trim() con la página de error. El nombre sí es obligatorio
            if (string.IsNullOrWhiteSpace(nombre_ubicacion))
            {
                TempData["Error"] = "Escribe el nombre de la ubicación.";
                return RedirectToAction("Administrador");
            }

            direccion = string.IsNullOrWhiteSpace(direccion) ? null : direccion;
            ciudad = string.IsNullOrWhiteSpace(ciudad) ? null : ciudad;

            var nombreBuscado = nombre_ubicacion.Trim().ToLower();
            var direccionBuscada = direccion?.Trim().ToLower();

            // Validar nombre duplicado (excluyendo el actual)
            bool existeNombre = _context.ubicacion_servicios
                .Any(u => u.nombre_ubicacion!.Trim().ToLower() == nombreBuscado && u.id_ubicacion != id_ubicacion);

            // Validar dirección duplicada (excluyendo el actual), solo si escribieron una
            bool existeDireccion = direccionBuscada != null && _context.ubicacion_servicios
                .Any(u => u.direccion!.Trim().ToLower() == direccionBuscada && u.id_ubicacion != id_ubicacion);

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
                ubicacion.id_zona = ZonaValida(id_zona);
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
        public IActionResult RegistrarParqueadero(string nombre_parqueadero, string direccion, string ciudad, decimal tarifa, int? id_zona)
        {
            if (TarifaIncompleta(tarifa))
            {
                TempData["Error"] = MensajeTarifaIncompleta;
                return RedirectToAction("Administrador");
            }

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
                    tarifa = tarifa,
                    id_zona = ZonaValida(id_zona)
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
        public IActionResult EditarParqueadero(int id_parqueadero, string nombre_parqueadero, string direccion, string ciudad, decimal tarifa, int? id_zona)
        {
            if (TarifaIncompleta(tarifa))
            {
                TempData["Error"] = MensajeTarifaIncompleta;
                return RedirectToAction("Administrador");
            }

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
                parqueadero.id_zona = ZonaValida(id_zona);
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
            if (!idUsuarioSesion.HasValue || (rolUsuario != 4 && rolUsuario != 1 && rolUsuario != 3 && rolUsuario != 2))
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

                // La foto del parqueo también lo parquea, con la misma regla y los mismos datos que Parquear en
                // Información (ActualizarEstadoKey). Si ya estaba parqueado (lo hizo el Key), solo queda la foto
                var parquear = IngresoReglas.PuedeParquear(ingreso);
                if (parquear)
                {
                    ingreso.estado_servicio = "parqueado";
                    ingreso.valet_despacho = null;
                    ingreso.usuario_parqueo = idUsuarioSesion.Value;
                    ingreso.fecha_parqueo = DateTime.Now;
                }

                _context.imagenes.Add(imagen);
                _context.SaveChanges();

                TempData["Exito"] = parquear
                    ? $"Foto guardada y vehículo {ingreso.placa} parqueado."
                    : "Foto del parqueo guardada.";
                return RedirectToAction("Tabla_Vehiculos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error en fotoParqueo: {ex.Message}");
                TempData["Error"] = "No fue posible guardar la foto del vehículo.";
                return RedirectToAction("Tabla_Vehiculos");
            }
        }

        // Foto de la transferencia (o del pago por QR) que toma el valet, que ya no cobra: queda en Información
        // y el banco la encuentra cargada al cobrar (FinalizarServicio). Responde JSON: la tabla no se recarga
        [HttpPost]
        public IActionResult fotoTransferencia(int id_ingreso, string fotoBase64)
        {
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (rolUsuario is not (1 or 2 or 3))
            {
                return Json(new { success = false, mensaje = "No tienes permiso para registrar la foto." });
            }

            // Verificamos que llegue la foto
            if (string.IsNullOrWhiteSpace(fotoBase64))
            {
                return Json(new { success = false, mensaje = "Toma la foto de la transferencia antes de guardar." });
            }

            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            // Mismo criterio que el ícono QR y el cobro: despachado, con valet de despacho y sin pagar
            if (!IngresoReglas.PuedeCobrar(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya no está pendiente de pago." });
            }

            // La evidencia no se cambia desde aquí; si no es correcta, el banco toma otra al cobrar
            if (ingreso.foto_transferencia != null)
            {
                return Json(new { success = false, mensaje = "La foto de la transferencia ya fue registrada." });
            }

            try
            {
                // Si viene así:
                // data:image/jpeg;base64,/9j/4AAQSk...

                string base64Data = fotoBase64.Contains(",")
                    ? fotoBase64.Split(',')[1]
                    : fotoBase64;

                // Validar que realmente sea Base64 válido
                ingreso.foto_transferencia = Convert.FromBase64String(base64Data);
                _context.SaveChanges();

                return Json(new { success = true, mensaje = $"Foto de la transferencia de {ingreso.placa} guardada. El banco la verá al cobrar." });
            }
            catch (FormatException)
            {
                return Json(new { success = false, mensaje = "La imagen recibida no tiene un formato válido." });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Error en fotoTransferencia: {ex.Message}");

                return Json(new { success = false, mensaje = "No fue posible guardar la foto de la transferencia." });
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
            var idsValets = new int?[] { ingreso.id_valet, ingreso.valet_despacho, ingreso.id_banco, ingreso.id_banco_responsable, ingreso.usuario_solicitud, ingreso.usuario_parqueo }
                .Where(id => id.HasValue)
                .Select(id => id.Value)
                .ToList();

            var nombres = _context.usuarios
                .Where(u => idsValets.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);

            // Lápiz del admin para corregir los operadores (CambiarOperador, que vuelve a validar todo)
            var esAdmin = HttpContext.Session.GetInt32("id_rol") == 3;
            var liquidado = Liquidado(ingreso);
            var nombreYApellido = (List<usuarios> lista) => lista.Select(u => new { id = u.id_usuario, nombre = u.nombres + " " + u.apellidos });

            // Cancelado: ya no se corrige nada. Historial de cambios (punto 6): el admin lo ve completo; de un
            // cancelado todos ven quién lo canceló y por qué
            var cancelado = IngresoReglas.EstaCancelado(ingreso);
            var cambios = esAdmin || cancelado ? CambiosIngresos(new[] { ingreso.id_ingreso }) : new List<cambio_ingreso>();
            var cancelacion = cancelado ? cambios.FirstOrDefault(c => c.campo == "cancelacion") : null;

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
                puedeSolicitar = PuedeSolicitarOperador(HttpContext.Session.GetInt32("id_rol"), ingreso),
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
                puedeReversar = (HttpContext.Session.GetInt32("id_rol") is 1 or 2 or 3) && IngresoReglas.PuedeReversarSolicitud(ingreso),
                // Quien lo debe cobrar ahora (Database/turnos.sql): el banco que lo registró o el que lo recibió
                bancoACargo = nombres.GetValueOrDefault(ingreso.id_banco_responsable ?? ingreso.id_banco),
                // Para el admin: quién está en cada papel (null = ese paso no ha pasado o ya no se cambia) y a quién
                // se puede poner. Nada si ya está liquidado o cancelado
                operadores = esAdmin && !liquidado && !cancelado
                    ? new
                    {
                        valet = ingreso.id_valet,
                        despacho = ingreso.valet_despacho,
                        parqueo = ingreso.usuario_parqueo,
                        banco = ingreso.estado_pago == "pagado" ? (int?)null : ingreso.id_banco_responsable ?? ingreso.id_banco,
                        valets = nombreYApellido(ValetsDisponibles()),
                        parqueadores = nombreYApellido(Parqueadores()),
                        bancos = nombreYApellido(UsuariosDisponibles(2))
                    }
                    : null,
                operadoresLiquidado = esAdmin && liquidado,
                // Lápiz del admin en los lugares (punto 3, CambiarLugar): el de ingreso entre las ubicaciones de la
                // zona del vehículo; el de entrega, solo si ya se solicitó. Nada si está liquidado o cancelado
                lugares = esAdmin && !liquidado && !cancelado
                    ? new
                    {
                        ingreso = ingreso.id_ubicacion,
                        entrega = ingreso.fecha_solicitud.HasValue,
                        ubicaciones = UbicacionesZona(ZonaIngreso(ingreso))
                            .Select(u => new { id = u.id_ubicacion, nombre = u.nombre_ubicacion })
                    }
                    : null,
                // Cancelar el servicio (punto 8): solo el admin, sin cobrar ni liquidar (CancelarServicio)
                puedeCancelar = esAdmin && IngresoReglas.PuedeCancelarse(ingreso),
                cancelacion = cancelacion != null ? CambioParaVista(cancelacion) : null,
                cambios = esAdmin ? cambios.Select(CambioParaVista) : null
            });
        }

        // Zona del vehículo: la que se guardó al registrarlo o, en los de antes de las zonas, la de su ubicación
        private static int? ZonaIngreso(ingresos ingreso) => ingreso.id_zona ?? ingreso.Ubicacion?.id_zona;

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
            ingreso.solicitud_cliente = null;
            ingreso.fecha_solicitud = null;
            ingreso.estado_antes_solicitud = null;

            _context.SaveChanges();

            return Json(new { success = true, mensaje = $"Solicitud del vehículo {ingreso.placa} reversada. Volvió a {ingreso.estado_servicio}." });
        }

        // Lápiz del admin en Información (tabla de vehículos): corrige quién atendió el vehículo. Solo lo que ya pasó,
        // nunca en un vehículo liquidado y solo a un usuario activo que pueda tener ese papel. El banco a cargo, solo
        // mientras no se ha cobrado: pasa con el turno de ese banco y queda el traspaso (sp_cambiarBancoACargo)
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CambiarOperador(int id_ingreso, string? campo, int id_usuario)
        {
            if (HttpContext.Session.GetInt32("id_rol") != 3)
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cambiar los operadores." });
            }

            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (Liquidado(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya está liquidado: sus operadores no se cambian." });
            }

            if (IngresoReglas.EstaCancelado(ingreso))
            {
                return Json(new { success = false, mensaje = $"El servicio de {ingreso.placa} está cancelado: sus operadores no se cambian." });
            }

            // Quién está hoy, a quién se puede poner y, si no se puede, por qué
            int? actual;
            List<usuarios> posibles;
            string? noSePuede;
            string papel;

            switch (campo)
            {
                case "valet":
                    (actual, posibles, papel) = (ingreso.id_valet, ValetsDisponibles(), "el valet");
                    noSePuede = actual.HasValue ? null : "todavía no tiene valet (usa Asignar valet)";
                    break;
                case "despacho":
                    (actual, posibles, papel) = (ingreso.valet_despacho, ValetsDisponibles(), "el valet de despacho");
                    noSePuede = actual.HasValue ? null : "todavía no se ha despachado";
                    break;
                case "parqueo":
                    (actual, posibles, papel) = (ingreso.usuario_parqueo, Parqueadores(), "quién lo parqueó");
                    noSePuede = actual.HasValue ? null : "todavía no se ha parqueado";
                    break;
                case "banco":
                    (actual, posibles, papel) = (ingreso.id_banco_responsable ?? ingreso.id_banco, UsuariosDisponibles(2), "el banco a cargo");
                    noSePuede = ingreso.estado_pago == "pagado" ? "ya se cobró" : null;
                    break;
                default:
                    return Json(new { success = false, mensaje = "Ese dato no se puede cambiar." });
            }

            if (noSePuede != null)
            {
                return Json(new { success = false, mensaje = $"No se puede cambiar {papel} de {ingreso.placa}: {noSePuede}." });
            }

            var nuevo = posibles.FirstOrDefault(u => u.id_usuario == id_usuario);

            if (nuevo == null)
            {
                return Json(new { success = false, mensaje = "Escoge un usuario activo de la lista." });
            }

            if (actual == id_usuario)
            {
                return Json(new { success = false, mensaje = "Es la misma persona: no cambió nada." });
            }

            var anterior = _context.usuarios
                .Where(u => u.id_usuario == actual)
                .Select(u => u.nombres + " " + u.apellidos)
                .FirstOrDefault() ?? "sin registro";

            switch (campo)
            {
                case "valet": ingreso.id_valet = id_usuario; break;
                case "despacho": ingreso.valet_despacho = id_usuario; break;
                case "parqueo": ingreso.usuario_parqueo = id_usuario; break;
            }

            // El cambio y su registro en el historial (punto 6) se guardan juntos: o queda todo o nada
            using (var transaccion = _context.Database.BeginTransaction())
            {
                if (campo == "banco")
                {
                    _context.Database.ExecuteSqlRaw("EXEC sp_cambiarBancoACargo @id_ingreso, @id_banco, @ahora",
                        new SqlParameter("@id_ingreso", ingreso.id_ingreso),
                        new SqlParameter("@id_banco", id_usuario),
                        new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now });
                }
                else
                {
                    _context.SaveChanges();
                }

                RegistrarCambio(ingreso.id_ingreso, campo, anterior, $"{nuevo.nombres} {nuevo.apellidos}");
                transaccion.Commit();
            }

            return Json(new
            {
                success = true,
                mensaje = $"Listo: {papel} de {ingreso.placa} ahora es {nuevo.nombres} {nuevo.apellidos} (antes {anterior})."
            });
        }

        private static bool Liquidado(ingresos ingreso) => ingreso.id_liquidacion.HasValue || ingreso.estado_liquidacion == true;

        // Lápiz del admin en Información > Lugares (punto 3). Lugar de ingreso: una ubicación activa de la zona del
        // vehículo. Lugar de entrega: solo si ya se solicitó (de la lista o escrito, máx. 50). Nunca en un vehículo
        // liquidado o cancelado. Los SPs vuelven a validar, guardan y dejan el registro en el historial
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CambiarLugar(int id_ingreso, string? campo, int? id_ubicacion, string? lugar_entrega)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cambiar los lugares." });
            }

            var ingreso = _context.ingresos
                .AsNoTracking()
                .Include(i => i.Ubicacion)
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            if (Liquidado(ingreso))
            {
                return Json(new { success = false, mensaje = $"El vehículo {ingreso.placa} ya está liquidado: sus lugares no se cambian." });
            }

            if (IngresoReglas.EstaCancelado(ingreso))
            {
                return Json(new { success = false, mensaje = $"El servicio de {ingreso.placa} está cancelado: sus lugares no se cambian." });
            }

            var idUsuario = HttpContext.Session.GetInt32("id")!.Value;
            var ahora = new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now };
            bool cambio;
            string mensaje;

            if (campo == "ingreso")
            {
                var nueva = UbicacionesZona(ZonaIngreso(ingreso)).FirstOrDefault(u => u.id_ubicacion == id_ubicacion);

                if (nueva == null)
                {
                    return Json(new { success = false, mensaje = "Escoge una ubicación de la lista." });
                }

                if (nueva.id_ubicacion == ingreso.id_ubicacion)
                {
                    return Json(new { success = false, mensaje = "Es el mismo lugar: no cambió nada." });
                }

                cambio = EjecutarCambio("EXEC sp_cambiarLugarIngreso @id_ingreso, @id_usuario, @id_ubicacion, @ahora",
                    new SqlParameter("@id_ingreso", ingreso.id_ingreso),
                    new SqlParameter("@id_usuario", idUsuario),
                    new SqlParameter("@id_ubicacion", nueva.id_ubicacion),
                    ahora);

                mensaje = $"Listo: el lugar de ingreso de {ingreso.placa} ahora es {nueva.nombre_ubicacion} (antes {ingreso.Ubicacion?.nombre_ubicacion ?? "sin lugar"}).";
            }
            else if (campo == "entrega")
            {
                if (!ingreso.fecha_solicitud.HasValue)
                {
                    return Json(new { success = false, mensaje = $"{ingreso.placa} todavía no se ha solicitado: el lugar de entrega se escoge al solicitarlo." });
                }

                var lugar = lugar_entrega?.Trim();

                if (string.IsNullOrEmpty(lugar))
                {
                    return Json(new { success = false, mensaje = "Escoge o escribe el lugar de entrega." });
                }

                // tbl_ingresos.lugar_entrega es VARCHAR(50), como en la solicitud del operador
                if (lugar.Length > 50)
                {
                    return Json(new { success = false, mensaje = "El lugar de entrega no puede tener más de 50 caracteres." });
                }

                if (lugar == ingreso.lugar_entrega)
                {
                    return Json(new { success = false, mensaje = "Es el mismo lugar: no cambió nada." });
                }

                cambio = EjecutarCambio("EXEC sp_cambiarLugarEntrega @id_ingreso, @id_usuario, @lugar_entrega, @ahora",
                    new SqlParameter("@id_ingreso", ingreso.id_ingreso),
                    new SqlParameter("@id_usuario", idUsuario),
                    new SqlParameter("@lugar_entrega", System.Data.SqlDbType.VarChar, 50) { Value = lugar },
                    ahora);

                mensaje = $"Listo: el lugar de entrega de {ingreso.placa} ahora es {lugar} (antes {ingreso.lugar_entrega ?? "sin lugar"}).";
            }
            else
            {
                return Json(new { success = false, mensaje = "Ese dato no se puede cambiar." });
            }

            return Json(cambio
                ? new { success = true, mensaje }
                : new { success = false, mensaje = $"No se pudo cambiar: {ingreso.placa} cambió mientras tanto. Vuelve a abrir Información." });
        }

        // Cancelar el servicio (punto 8): solo el admin, con motivo, y solo si no se ha cobrado ni liquidado ni terminó.
        // sp_cancelarServicio vuelve a validar, lo deja "cancelado" y guarda el motivo en el historial. No se deshace
        // desde la app
        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CancelarServicio(int id_ingreso, string? motivo)
        {
            if (!EsAdmin())
            {
                return Json(new { success = false, mensaje = "Solo el administrador puede cancelar un servicio." });
            }

            var ingreso = _context.ingresos.AsNoTracking().FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return Json(new { success = false, mensaje = "No se encontró el vehículo." });
            }

            motivo = motivo?.Trim();

            if (string.IsNullOrEmpty(motivo) || motivo.Length < 5)
            {
                return Json(new { success = false, mensaje = "Escribe el motivo de la cancelación (mínimo 5 letras)." });
            }

            if (motivo.Length > 250)
            {
                return Json(new { success = false, mensaje = "El motivo no puede tener más de 250 caracteres." });
            }

            if (!IngresoReglas.PuedeCancelarse(ingreso))
            {
                var porque = IngresoReglas.EstaCancelado(ingreso) ? "ya está cancelado"
                           : ingreso.estado_pago?.Trim().ToLower() == "pagado" ? "ya se cobró"
                           : Liquidado(ingreso) ? "ya está liquidado"
                           : "el servicio ya terminó";

                return Json(new { success = false, mensaje = $"No se puede cancelar {ingreso.placa}: {porque}." });
            }

            var cancelado = EjecutarCambio("EXEC sp_cancelarServicio @id_ingreso, @id_usuario, @motivo, @ahora",
                new SqlParameter("@id_ingreso", ingreso.id_ingreso),
                new SqlParameter("@id_usuario", HttpContext.Session.GetInt32("id")!.Value),
                new SqlParameter("@motivo", System.Data.SqlDbType.NVarChar, 250) { Value = motivo },
                new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now });

            return Json(cancelado
                ? new { success = true, mensaje = $"Servicio de {ingreso.placa} cancelado." }
                : new { success = false, mensaje = $"No se pudo cancelar: {ingreso.placa} cambió mientras tanto (¿lo acaban de cobrar?). Vuelve a abrir Información." });
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

        // Valet, banco o admin solicitan con la misma regla que el cliente (IngresoReglas.PuedeSolicitarse)
        private static bool PuedeSolicitarOperador(int? rol, ingresos ingreso)
        {
            return (rol == 1 || rol == 2 || rol == 3) && IngresoReglas.PuedeSolicitarse(ingreso);
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

            if (!PuedeSolicitarOperador(HttpContext.Session.GetInt32("id_rol"), ingreso))
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
            ingreso.solicitud_cliente = false;
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

            // WebM (Android y los de antes) o MP4 (iPhone: empieza con la caja "ftyp" desde el byte 4)
            var videos = _context.imagenes
                .AsNoTracking()
                .Where(i =>
                    i.id_ingreso == idIngreso &&
                    i.dato_imagen != null &&
                    ((i.dato_imagen.Length >= 4 &&
                      i.dato_imagen[0] == 0x1A &&
                      i.dato_imagen[1] == 0x45 &&
                      i.dato_imagen[2] == 0xDF &&
                      i.dato_imagen[3] == 0xA3) ||
                     (i.dato_imagen.Length >= 8 &&
                      i.dato_imagen[4] == 0x66 &&
                      i.dato_imagen[5] == 0x74 &&
                      i.dato_imagen[6] == 0x79 &&
                      i.dato_imagen[7] == 0x70))
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

            // MP4 (iPhone) empieza con la caja "ftyp" desde el byte 4; lo demás es WebM
            var esMp4 = dato.Length >= 8 && dato[4] == 0x66 && dato[5] == 0x74 && dato[6] == 0x79 && dato[7] == 0x70;

            return File(dato, esMp4 ? "video/mp4" : "video/webm", enableRangeProcessing: true);
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

            // 4b. El banco que sigue trabajando después de la hora de margen de su turno pasa a Corrido, con sus
            //     vehículos sin cobrar (Database/turnos.sql)
            if (sesionActiva.id_rol == 2)
            {
                await _context.Database.ExecuteSqlRawAsync("EXEC sp_pasarACorrido @id_usuario, @ahora",
                    new SqlParameter("@id_usuario", idUsuario.Value),
                    new SqlParameter("@ahora", System.Data.SqlDbType.DateTime2) { Value = sesionActiva.ultima_actividad });
            }

            // 5. Refrescar variable de sesión local
            HttpContext.Session.SetString("UltimaActividad", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

            return Ok(new { success = true, message = "Sesión renovada" });
        }
    }
}
