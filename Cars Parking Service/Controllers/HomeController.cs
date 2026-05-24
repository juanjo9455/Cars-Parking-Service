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
        public HomeController(ApplicationDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Login()
        {

            return View();
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

            var parametros = new[] {
                new SqlParameter("@placa", placaUpper ?? (object)DBNull.Value),
                new SqlParameter("@lugar", nombreUbicacion ?? (object)DBNull.Value),
                new SqlParameter("@estado_servicio", estadoServicio ?? (object)DBNull.Value),
                new SqlParameter("@estado_pago", estadoPago ?? (object)DBNull.Value),
                new SqlParameter("@id_usuario", idUsuario),
                new SqlParameter("@parqueadero", nombreParqueadero ?? (object)DBNull.Value),
                new SqlParameter("@fecha_inicio", fechaInicio.HasValue ? (object)fechaInicio.Value.Date : DBNull.Value),
                new SqlParameter("@fecha_fin", fechaFin.HasValue ? (object)fechaFin.Value.Date : DBNull.Value)
            };

            var ingresos = _context.ingresos.FromSqlRaw(
                "EXEC sp_consultarRegistros @placa, @lugar, @estado_servicio, @estado_pago, @id_usuario, @parqueadero, @fecha_inicio, @fecha_fin",
                parametros)
                .AsEnumerable()
                .OrderByDescending(u => u.fecha_ingreso)
                .ThenBy(u => u.estado_pago)
                .ToList();

            int totalRegistros = ingresos.Count();

            ViewBag.TotalRegistros = totalRegistros;

            ViewBag.Ubicaciones = _context.ubicacion_servicios.ToList();
            ViewBag.Parqueaderos = _context.parqueaderos.ToList();

            ViewData["FiltroPlaca"] = placa;
            ViewData["FiltroLugar"] = lugar;
            ViewData["FiltroEstadoServicio"] = estado_servicio;
            ViewData["FiltroEstadoPago"] = estado_pago;
            ViewData["FiltroParqueadero"] = parqueadero;
            ViewData["FiltroFechaInicio"] = fechaInicio;
            ViewData["FiltroFechaFin"] = fechaFin;

            return View(ingresos);
        }
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
            if (id_valet <= 0)
            {
                ViewBag.Error = "Debe seleccionar un valet para el ingreso del vehículo.";
                return View("Ingreso_Vehiculos");
            }

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


                // validar si el vehiculo ya esta en el parqueadero
                if (ingresoActivo != null)
                {
                    System.Diagnostics.Debug.WriteLine($"Found ingresoActivo id:{ingresoActivo.id_ingreso} placa:'{ingresoActivo.placa}' estado_servicio:'{ingresoActivo.estado_servicio}' estado_pago:'{ingresoActivo.estado_pago}'");

                    // caso 1: El vehiculo esta actualmente en servicio (no ha salido)
                    if (ingresoActivo.estado_servicio == "activo")
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
                obj_ingreso.id_valet = id_valet;
                obj_ingreso.id_banco = id_banco;

                // Si la ubicación tiene un valor fijo inicial, pudieras ponerlo aquí (opcional)
                obj_ingreso.valor_servicio = 0;
                obj_ingreso.valor_propina = 0;


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

                    if (!string.IsNullOrEmpty(telefonoCliente) && enviarWhatsapp)
                    {

                        await EnviarWhatsAppIngreso(placa, nombreCliente, telefonoCliente, obj_ingreso.id_ingreso);

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
        private async Task EnviarWhatsAppIngreso(string placa, string nombre, string telefono, int idIngreso)
        {
            var token = "EAAN1Ou7KFoABOxsr5ohcvViIX6kLd90FRB4gmnNUNFmyKqlOIfLGWN7XCFuy96Gk6l940v8mxzSU9z9ldvZCYSDhQ9hSlZBzoQsUZBRNEkeHkKqsjIhu7FUQ5i7bSd5tE9fxBZBZC9ar1DgPjGSazftOQjXPanTJDqLhom7aVZBpvcDnrScZCkZAamOTj19Ib7aI4gZDZD";
            var url = "https://graph.facebook.com/v22.0/625779610608874/messages";

            string baseUrl = "https://62j90cdp-7140.use2.devtunnels.ms/Payment/Estado_Servicio?idIngreso=";
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
            new {
                type = "header",
                parameters = new object[]
                {
                    new {
                        type = "image",
                        image = new {
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
                    new { type = "text", text = telefono },
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

            // Validar si el correo ya le pertenece a OTRO usuario
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
                TempData["Error"] = "No se encontró el parqueadero a editar.";
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
    }
}