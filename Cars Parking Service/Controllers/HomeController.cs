using AspNetCoreGeneratedDocument;
using CarsParkingService.Data;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using Microsoft.JSInterop.Infrastructure;
using NuGet.Common;
using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace CarsParkingService.Controllers
{
    public class HomeController : Controller
    {
        private readonly ApplicationDbContext _context;
        
        // Diccionario para almacenar códigos de seguridad generados
        // Key: id_ingreso, Value: (código, fecha_generación)
        private static Dictionary<int, (string codigo, DateTime fechaGeneracion)> codigosSeguridad = new();

        public HomeController(ApplicationDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {

            var usuarioId = HttpContext.Session.GetInt32("id");

            var nombreUbicacion = (from s in _context.sesiones
                                   join u in _context.ubicacion_servicios
                                   on s.id_ubicacion equals u.id_ubicacion
                                   where s.id_usuario == usuarioId
                                   select u.nombre_ubicacion)
                                  .FirstOrDefault();

            ViewBag.ubicacion = nombreUbicacion ?? "Ubicación no disponible";

            return View();

        }

        public IActionResult Login()
        {

            return View();
        }

        // =================== vista key =================== //

        // GET: /Home/VistaKey
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult VistaKey(string placa, string estado_servicio)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            System.Diagnostics.Debug.WriteLine($"=== VistaKey GET ===");
            System.Diagnostics.Debug.WriteLine($"idUsuarioSesion: {idUsuarioSesion}");
            System.Diagnostics.Debug.WriteLine($"rolUsuario: {rolUsuario}");

            if (!idUsuarioSesion.HasValue || (rolUsuario != 4))
            {
                System.Diagnostics.Debug.WriteLine($"Acceso denegado: no es rol Key");
                return RedirectToAction("Login", "Auth");
            }

            var query = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Include(i => i.Ubicacion)
                .AsQueryable();

            if (!string.IsNullOrEmpty(placa))
            {
                query = query.Where(i => i.placa.Contains(placa.Trim().ToUpper()));
            }

            if (!string.IsNullOrEmpty(estado_servicio))
            {
                query = query.Where(i => i.estado_servicio == estado_servicio);
            }

            var sesion = _context.sesiones
                .FirstOrDefault(s =>
                    s.id_usuario == idUsuarioSesion &&
                    s.fecha_fin == null
                );

            if (sesion == null)
            {
                System.Diagnostics.Debug.WriteLine($"ERROR: No hay sesión activa para el usuario {idUsuarioSesion}");
                return RedirectToAction("Login");
            }

            var ingresos = query
                .Where(i =>
                    i.id_parqueadero == sesion.id_parqueadero &&
                    i.estado_servicio != "finalizado" &&
                    i.estado_servicio != "despachado" &&
                    i.estado_pago != "pagado")
                .AsEnumerable()
                .OrderByDescending(i => i.estado_servicio?.Trim().ToLower() == "solicitado")
                .ThenByDescending(i => i.fecha_ingreso)
                .ToList();

            var parqueadero = _context.parqueaderos.FirstOrDefault(p => p.id_parqueadero == sesion.id_parqueadero);

            var idsIngresos = ingresos.Select(i => i.id_ingreso).ToList();

            var imagenesPorIngreso = _context.imagenes
                .Where(img => idsIngresos.Contains(img.id_ingreso))
                .AsEnumerable()
                .Select(img => new
                {
                    img.id_ingreso,
                    foto = $"data:image/jpeg;base64,{Convert.ToBase64String(img.dato_imagen)}"
                })
                .GroupBy(x => x.id_ingreso)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => x.foto).ToList()
                );

            var vistaKeyInfo = ingresos.ToDictionary(
                i => i.id_ingreso,
                i => new
                {
                    idIngreso = i.id_ingreso,
                    placa = i.placa,
                    cliente = i.nombre_cliente ?? "N/A",
                    valet = i.Valet?.nombres ?? "N/A",
                    ubicacion = i.Ubicacion?.nombre_ubicacion ?? "N/A",
                    fotos = imagenesPorIngreso.TryGetValue(i.id_ingreso, out var fotos) ? fotos : new List<string>()
                }
            );

            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroEstado"] = estado_servicio;
            ViewData["NombreParqueadero"] = parqueadero?.nombre_parqueadero ?? "Parqueadero";
            ViewBag.valets = _context.usuarios.Where(v => v.id_rol == 1).ToList();
            ViewBag.VistaKeyInfoJson = System.Text.Json.JsonSerializer.Serialize(vistaKeyInfo);

            return View(ingresos);
        }

        // POST: Cambiar el estado desde la vista Key
        [HttpPost]
        public IActionResult ActualizarEstadoKey(int id_ingreso, string nuevo_estado, int? id_valet = null)
        {
            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id_ingreso);
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

                if (nuevo_estado == "despachado")
                {
                    ingreso.fecha_salida = DateTime.Now;
                }

                _context.SaveChanges();
            }

            // Lo retornamos a la vista
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
                        : "Sin banco"
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
        public IActionResult ObtenerEnCurso()
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
                    i.estado_servicio.Trim().ToLower() == "en curso"
                )
                .AsQueryable();

            // Filtrado por rol
            if (idUsuario.HasValue)
            {
                // Valet
                if (rolUsuario == 1)
                {
                    query = query.Where(i => i.id_valet == idUsuario.Value);
                }

                // Banco
                else if (rolUsuario == 2)
                {
                    query = query.Where(i => i.id_banco == idUsuario.Value);
                }

                // Otros roles
                else if (rolUsuario != 3)
                {
                    query = query.Where(i =>
                        i.id_valet == idUsuario.Value ||
                        i.id_banco == idUsuario.Value
                    );
                }
            }

            // Convertimos datos
            var enCurso = query
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
                cantidad = enCurso.Count(),
                vehiculos = enCurso
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
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuarioSesion.HasValue)
            {
                return RedirectToAction("Login", "Auth");
            }

            int idUsuario = idUsuarioSesion.Value;

            // Convertir placa a mayúsculas
            string? placaUpper = !string.IsNullOrEmpty(placa) ? placa.Trim().ToUpper() : null;
            string? nombreUbicacion = !string.IsNullOrEmpty(lugar) ? lugar : null;
            string? estadoServicio = !string.IsNullOrEmpty(estado_servicio) ? estado_servicio : null;
            string? estadoPago = !string.IsNullOrEmpty(estado_pago) ? estado_pago : null;
            string? nombreParqueadero = !string.IsNullOrEmpty(parqueadero) ? parqueadero : null;

            // ?? DEBUG: Ver qué parámetros se envían
            System.Diagnostics.Debug.WriteLine("=== PARÁMETROS SP ===");
            System.Diagnostics.Debug.WriteLine($"Placa: {placaUpper ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Lugar: {nombreUbicacion ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Estado Servicio: {estadoServicio ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Estado Pago: {estadoPago ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Parqueadero: {nombreParqueadero ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Fecha Inicio: {fechaInicio?.ToString("yyyy-MM-dd") ?? "NULL"}");
            System.Diagnostics.Debug.WriteLine($"Fecha Fin: {fechaFin?.ToString("yyyy-MM-dd") ?? "NULL"}");

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
            if (rolUsuario != 3)
            {
                parametros.Add(new SqlParameter("@id_usuario", idUsuario));
            }
            else
            {
                parametros.Add(new SqlParameter("@id_usuario", DBNull.Value));
            }

            // ✔ conversión a array (ESTO ES LO CLAVE)
            var ingresos = _context.ingresos.FromSqlRaw(
                "EXEC sp_consultarRegistros @placa, @lugar, @estado_servicio, @estado_pago, @id_usuario, @parqueadero, @fecha_inicio, @fecha_fin", 
                parametros.ToArray()
            )
            .AsEnumerable()
            .OrderByDescending(u => u.fecha_ingreso)
            .ThenBy(u => u.estado_pago)
            .ToList();
            int totalRegistros = ingresos.Count();

            ViewBag.TotalRegistros = totalRegistros;

            ViewBag.Ubicaciones = _context.ubicacion_servicios.ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.ToList();
            ViewBag.Valets = _context.usuarios.Where(u => u.id_rol == 1 && u.estado == true).ToList();


            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroLugar"] = lugar;
            ViewData["FiltroEstadoServicio"] = estado_servicio;
            ViewData["FiltroEstadoPago"] = estado_pago;
            ViewData["FiltroParqueadero"] = parqueadero;
            ViewData["FiltroFechaInicio"] = fechaInicio;
            ViewData["FiltroFechaFin"] = fechaFin;

            return View(ingresos);
        }
        [HttpPost]
        public IActionResult actualizarValet(int id_ingreso, int id_valet)
        {
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id_ingreso);

            if (ingreso == null)
            {
                return NotFound();
            }

            ingreso.id_valet = id_valet;

            _context.SaveChanges();

            return RedirectToAction("Tabla_Vehiculos");
        }
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Ingreso_Vehiculos()
        {
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
        public async Task<IActionResult> IngresoVehiculos(ingresos obj_ingreso, int id_valet, int id_banco, string firmaBase64, bool sin_objetos_valor = false, List<string>? fotos = null, string? videoBase64 = null)
        {
            // DEBUG TEMPORAL
            System.Diagnostics.Debug.WriteLine("=== ENTRÓ AL POST ===");
            System.Diagnostics.Debug.WriteLine($"placa: {obj_ingreso?.placa}");
            System.Diagnostics.Debug.WriteLine($"nombre_cliente: {obj_ingreso?.nombre_cliente}");
            System.Diagnostics.Debug.WriteLine($"id_valet: {id_valet}");
            System.Diagnostics.Debug.WriteLine($"id_banco: {id_banco}");
            System.Diagnostics.Debug.WriteLine($"ModelState válido: {ModelState.IsValid}");

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
                // OBTENER PARQUEADERO DE SESION
                // ==============================
                var idUsuarioSesion = HttpContext.Session.GetInt32("id");
                var rolUsuarioSesion = HttpContext.Session.GetInt32("id_rol");

                // Buscar sesión activa del usuario
                var sesionUsuario = _context.sesiones
                    .FirstOrDefault(s =>
                        s.id_usuario == idUsuarioSesion &&
                        s.fecha_fin == null
                    );

                // Si el usuario tiene una sesión con parqueadero (Valet o Banco con sesión),
                // usar ese parqueadero en lugar del que viene del formulario
                if (sesionUsuario != null && sesionUsuario.id_parqueadero.HasValue)
                {
                    System.Diagnostics.Debug.WriteLine($"Asignando parqueadero de sesión: {sesionUsuario.id_parqueadero}");
                    obj_ingreso.id_parqueadero = sesionUsuario.id_parqueadero.Value;
                }

                // validar si el vehiculo ya esta en el parqueadero
                if (ingresoActivo != null)
                {
                    System.Diagnostics.Debug.WriteLine($"Found ingresoActivo id:{ingresoActivo.id_ingreso} placa:'{ingresoActivo.placa}' estado_servicio:'{ingresoActivo.estado_servicio}' estado_pago:'{ingresoActivo.estado_pago}'");

                    // caso 1: El vehiculo esta actualmente en servicio (no ha salido)
                    if (ingresoActivo.estado_servicio == "activo" || ingresoActivo.estado_servicio == "solicitado" || ingresoActivo.estado_servicio == "en curso" || ingresoActivo.estado_servicio == "parqueado")
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
                obj_ingreso.estado_servicio = "activo";
                if (id_valet == 0) {

                    obj_ingreso.id_valet = null;

                }else{

                    obj_ingreso.id_valet = id_valet;

                }
                obj_ingreso.id_banco = id_banco;

                // Si la ubicación tiene un valor fijo inicial, pudieras ponerlo aquí (opcional)
                obj_ingreso.valor_servicio = 0;
                obj_ingreso.valor_propina = 0;
                obj_ingreso.total_servicio = 0;

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

                _context.ingresos.Add(obj_ingreso);

                // AGREGA ESTO:
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

                        await EnviarWhatsAppIngreso(placa, nombreCliente, obj_ingreso.id_ingreso, telefonoCliente);

                    }

                }
                catch (Exception ex)
                {

                    System.Diagnostics.Debug.WriteLine($"Error enviado Whatsapp: {ex.Message}");

                }

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
                return View("Ingreso_Vehiculos");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Exception: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"StackTrace: {ex.StackTrace}");
                ViewBag.Error = "Ocurrio un error inesperado. Por favor, intenta nuevamente.";
                return View("Ingreso_Vehiculos");
            }
        }

        // Metodo para enviar mensaje al whatsapp para solicitar vehiculo y pagar servicio
        private async Task EnviarWhatsAppIngreso(string placa, string nombre, int idIngreso, string telefono)
        {
            var token = "EAAN1Ou7KFoABOxsr5ohcvViIX6kLd90FRB4gmnNUNFmyKqlOIfLGWN7XCFuy96Gk6l940v8mxzSU9z9ldvZCYSDhQ9hSlZBzoQsUZBRNEkeHkKqsjIhu7FUQ5i7bSd5tE9fxBZBZC9ar1DgPjGSazftOQjXPanTJDqLhom7aVZBpvcDnrScZCkZAamOTj19Ib7aI4gZDZD";
            var url = "https://graph.facebook.com/v22.0/625779610608874/messages";

            string baseUrl = "http://143.198.163.1:5000//Payment/Estado_Servicio?idIngreso=";
            string linkPago = $"{baseUrl}{idIngreso}";

            var payload = new
            {
                messaging_product = "whatsapp",
                to = telefono,
                type = "template",
                template = new
                {
                    name = "prueba_cars6",
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
                                link = "https://archivos.crmgrupoge.com:8085/logo_cars_parking.jpg"
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

                var response = await client.PostAsync(url, content);
                var result = await response.Content.ReadAsStringAsync();
                System.Diagnostics.Debug.WriteLine($"=== WHATSAPP STATUS: {response.StatusCode} ===");
                System.Diagnostics.Debug.WriteLine($"=== WHATSAPP RESPONSE: {result} ===");
                //var result = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    System.Diagnostics.Debug.WriteLine("? ERROR WHATSAPP:");
                    System.Diagnostics.Debug.WriteLine($"Status: {response.StatusCode}");
                    System.Diagnostics.Debug.WriteLine(result);
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("? WhatsApp enviado correctamente");
                    System.Diagnostics.Debug.WriteLine(result);
                }

                System.Diagnostics.Debug.WriteLine($"WhatsApp response: {result}");
            }
        }

        private void CargarDatosFormulario()
        {
            ViewBag.Valets = _context.usuarios.Where(u => u.id_rol == 1 && u.estado == true).ToList();
            ViewBag.Bancos = _context.usuarios.Where(u => u.id_rol == 2 && u.estado == true).ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.ToList();
            ViewBag.UbicacionesS = _context.ubicacion_servicios.ToList();

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
                Random random = new Random();
                string codigo = random.Next(100000, 999999).ToString();

                // Almacenar código con expiración de 5 minutos
                codigosSeguridad[id] = (codigo, DateTime.Now);

                // Actualizar método de pago
                ingreso.codigo_seguridad = codigo;
                ingreso.fecha_expiracion_codigo = DateTime.Now.AddMinutes(1); ;
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
                // Validar si el código existe
                if (!codigosSeguridad.ContainsKey(id))
                {
                    return Json(new { success = false, message = "No hay código generado para este ingreso" });
                }

                var (codigoGenerado, fechaGeneracion) = codigosSeguridad[id];

                // Validar que no haya expirado (5 minutos)
                if ((DateTime.Now - fechaGeneracion).TotalMinutes > 5)
                {
                    codigosSeguridad.Remove(id);
                    return Json(new { success = false, message = "Código expirado" });
                }

                // Validar que el código coincida
                if (codigoGenerado != codigo)
                {
                    return Json(new { success = false, message = "Código inválido" });
                }

                // Código válido - remover de almacenamiento
                codigosSeguridad.Remove(id);
                return Json(new { success = true, message = "Código validado correctamente" });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error validando código: {ex.Message}");
                return Json(new { success = false, message = "Error al validar código" });
            }
        }

        [HttpPost]
        public IActionResult FinalizarServicio(int id, string estadoServicio)
        {
            try
            {
                var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == id);
                if (ingreso == null)
                {
                    return Json(new { success = false, message = "Ingreso no encontrado" });
                }

                ingreso.estado_servicio = estadoServicio;
                ingreso.estado_pago = "pagado";

                if (estadoServicio == "finalizado")
                {
                    ingreso.fecha_salida = DateTime.Now;
                    ingreso.fecha_entrega = DateTime.Now;
                }

                _context.SaveChanges();

                return Json(new { success = true, message = "Servicio finalizado correctamente" });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error finalizando servicio: {ex.Message}");
                return Json(new { success = false, message = "Error al finalizar servicio" });
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
                .Any(u => u.correo.Trim().ToLower() == correo.Trim().ToLower() && u.id_usuario != id_usuario && u.estado == true);

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

        // Nuevo método para obtener ingresos de VistaKey sin recargar la página
        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult ObtenerIngresosPorParqueadero()
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            System.Diagnostics.Debug.WriteLine($"=== ObtenerIngresosPorParqueadero ===");
            System.Diagnostics.Debug.WriteLine($"idUsuarioSesion: {idUsuarioSesion}");
            System.Diagnostics.Debug.WriteLine($"rolUsuario: {rolUsuario}");

            // Verificar que sea rol Key (4)
            if (!idUsuarioSesion.HasValue || (rolUsuario != 4))
            {
                System.Diagnostics.Debug.WriteLine($"Acceso denegado: no es rol Key");
                return Unauthorized();
            }

            // Buscamos la sesión activa con el usuario
            var sesion = _context.sesiones
                .FirstOrDefault(s =>
                    s.id_usuario == idUsuarioSesion &&
                    s.fecha_fin == null
                );

            System.Diagnostics.Debug.WriteLine($"Sesión encontrada: {(sesion != null ? "SÍ" : "NO")}");
            if (sesion != null)
            {
                System.Diagnostics.Debug.WriteLine($"id_parqueadero de sesión: {sesion.id_parqueadero}");
            }

            if (sesion == null)
            {
                System.Diagnostics.Debug.WriteLine($"No hay sesión activa");
                return Unauthorized();
            }

            // Obtener ingresos del parqueadero actual
            var ingresos = _context.ingresos
                .Include(i => i.Valet)
                .Include(i => i.Banco)
                .Where(i =>
                    i.id_parqueadero == sesion.id_parqueadero &&
                    i.estado_servicio != "finalizado" &&
                    i.estado_servicio != "despachado" &&
                    i.estado_pago != "pagado")
                .AsEnumerable()
                .OrderByDescending(i => i.estado_servicio?.Trim().ToLower() == "solicitado")
                .ThenByDescending(i => i.fecha_ingreso)
                .Select(i => new
                {
                    id = i.id_ingreso,
                    placa = i.placa,
                    estado_servicio = i.estado_servicio,
                    estado_pago = i.estado_pago,
                    id_valet = i.id_valet,
                    id_banco = i.id_banco,
                    nombre_valet = i.Valet != null ? i.Valet.nombres : "N/A",
                    nombre_banco = i.Banco != null ? i.Banco.nombres : "N/A",
                    fecha_ingreso = i.fecha_ingreso
                })
                .ToList();

            System.Diagnostics.Debug.WriteLine($"Total ingresos obtenidos: {ingresos.Count}");
            foreach (var ing in ingresos)
            {
                System.Diagnostics.Debug.WriteLine($"  - ID: {ing.id}, Placa: {ing.placa}, Estado: {ing.estado_servicio}, Pago: {ing.estado_pago}");
            }

            return Json(new
            {
                cantidad = ingresos.Count(),
                ingresos = ingresos,
                serverTime = DateTime.Now.ToString("O")
            });
        }

        [HttpPost]
        public IActionResult fotoParqueo(int id_ingreso, string fotoBase64)
        {
            var idUsuarioSesion = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuarioSesion.HasValue || rolUsuario != 1)
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
    }
}