using AspNetCoreGeneratedDocument;
using CarsParkingService.Data;
using CarsParkingService.Helpers;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop.Infrastructure;
using System.Diagnostics;

namespace CarsParkingService.Controllers
{
    public class PaymentController : Controller
    {
        private readonly ApplicationDbContext _context;

        public PaymentController(ApplicationDbContext context)
        {
            _context = context;
        }

        public IActionResult Pago()
        {
            return View();
        }

        [AllowAnonymous]
        public IActionResult Estado_Servicio(int? idIngreso)
        {
            if (idIngreso == null)
            {
                return View(); // vista vacía o mensaje
            }

            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == idIngreso);

            int idValet = ingreso?.id_valet ?? 0;

            var valet = _context.usuarios
                .FirstOrDefault(i => i.id_usuario == idValet);

            ViewBag.imagenUsuario = valet?.imagen_usuario ?? string.Empty;
            ViewBag.nombreUsuario = valet?.nombres ?? "Valet";

            //var ubicacion_Servicio = _context.ubicacion_servicios.Where(u => u.id_ubicacion == ingreso.id_ubicacion).FirstOrDefault();
            //ViewBag.tarifa = ubicacion_Servicio.valor_servicio;

            if (ingreso != null)
            {
                var ubicacionServicio = _context.ubicacion_servicios
                    .FirstOrDefault(u => u.id_ubicacion == ingreso.id_ubicacion);

                ViewBag.tarifa = ubicacionServicio?.valor_servicio;
            }

            if (ingreso == null)
            {
                return NotFound();
            }

            return View(ingreso);
        }

        // Metodo para editar estado de servicio a solicitado
        [HttpPost]
        public IActionResult SolicitarVehiculo([FromBody] SolicitudDto data)
        {
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == data.idIngreso);

            if (ingreso == null)
                return NotFound();

            var fechaFinServicio = DateTime.Now.AddMinutes(20);

            // 🚫 evitar re-ejecución
            if (ingreso.estado_servicio == "solicitado")
            {
                if (!ingreso.fecha_fin_servicio.HasValue)
                {
                    ingreso.fecha_fin_servicio = fechaFinServicio;
                    _context.SaveChanges();
                }

                return Ok(new { mensaje = "Ya estaba solicitado", fechaFinServicio = ingreso.fecha_fin_servicio });
            }

            // Despachado, finalizado o sin valet no se solicita (misma regla que el operador)
            if (!IngresoReglas.PuedeSolicitarse(ingreso))
            {
                var estado = ingreso.estado_servicio?.Trim().ToLower();
                var mensaje = estado == "despachado" || estado == "finalizado" ? "Tu vehículo ya fue entregado."
                            : estado == "cancelado" ? "Este servicio fue cancelado."
                            : "Tu vehículo todavía no se puede solicitar. Intenta en unos minutos.";

                return Conflict(new { mensaje });
            }

            // Con "Otra ubicación" el cliente escribe el lugar: tbl_ingresos.lugar_entrega es VARCHAR(50)
            var lugarEntrega = data.lugarEntrega?.Trim();

            if (string.IsNullOrEmpty(lugarEntrega))
                return BadRequest(new { mensaje = "Selecciona el lugar de entrega." });

            if (lugarEntrega.Length > 50)
                return BadRequest(new { mensaje = "El lugar de entrega no puede tener más de 50 caracteres." });

            Console.WriteLine("ANTES DE GUARDAR:");
            Console.WriteLine(ingreso.estado_servicio);

            // Quién y cuándo (puntos 26 y 27): null = el cliente desde su enlace. El estado anterior
            // se guarda para poder reversar una solicitud hecha por error (punto 21)
            ingreso.estado_antes_solicitud = ingreso.estado_servicio;
            ingreso.usuario_solicitud = null;
            ingreso.solicitud_cliente = true;
            ingreso.fecha_solicitud = DateTime.Now;

            ingreso.estado_servicio = "solicitado";
            ingreso.fecha_fin_servicio = fechaFinServicio;
            ingreso.lugar_entrega = lugarEntrega;

            _context.SaveChanges(); // ⚠️ te faltaba esto

            Console.WriteLine("DESPUÉS DE GUARDAR:");
            Console.WriteLine(ingreso.estado_servicio);

            var verificacion = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == ingreso.id_ingreso);

            Console.WriteLine("LEIDO DESDE BD:");
            Console.WriteLine(verificacion?.estado_servicio);

            return Ok(new { mensaje = "Actualizado correctamente", fechaFinServicio = ingreso.fecha_fin_servicio });
        }

        // Métodos que el cliente puede elegir en su página
        private static readonly string[] MetodosPagoCliente = { "Efectivo", "QR", "Nequi" };

        // El cliente pide el carro y deja su pago (propina y método) en un solo paso y en una sola escritura en la base:
        // antes eran dos (SolicitarVehiculo y después GuardarPago) y muchos se iban sin hacer el segundo. Mismas reglas
        // que esas dos acciones; la tarifa sale de la ubicación del servicio, no de lo que mande el navegador
        [HttpPost]
        public IActionResult SolicitarConPago([FromBody] SolicitudPagoDto data)
        {
            var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == data.idIngreso);

            if (ingreso == null)
                return NotFound(new { mensaje = "No encontramos tu vehículo." });

            // Ya pedido y con pago (doble toque o un reintento): no se repite
            if (ingreso.estado_servicio == "solicitado" && ingreso.estado_pago == "solicitado")
                return Ok(new { mensaje = "Ya estaba solicitado", fechaFinServicio = ingreso.fecha_fin_servicio?.ToString("O"), total = ingreso.total_servicio, metodo = ingreso.metodo_pago });

            // Solo activo o parqueado, con valet y sin pagar (misma regla que SolicitarVehiculo y el operador)
            if (!IngresoReglas.PuedeSolicitarse(ingreso))
            {
                var estado = ingreso.estado_servicio?.Trim().ToLower();
                var mensaje = estado == "despachado" || estado == "finalizado" ? "Tu vehículo ya fue entregado."
                            : estado == "solicitado" ? "Tu vehículo ya fue solicitado."
                            : estado == "cancelado" ? "Este servicio fue cancelado."
                            : "Tu vehículo todavía no se puede solicitar. Intenta en unos minutos.";

                return Conflict(new { mensaje });
            }

            // Con "Otra ubicación" el cliente escribe el lugar: tbl_ingresos.lugar_entrega es VARCHAR(50)
            var lugarEntrega = data.lugarEntrega?.Trim();

            if (string.IsNullOrEmpty(lugarEntrega))
                return BadRequest(new { mensaje = "Selecciona el lugar de entrega." });

            if (lugarEntrega.Length > 50)
                return BadRequest(new { mensaje = "El lugar de entrega no puede tener más de 50 caracteres." });

            // Propina: sin centavos, no negativa y con un tope razonable (la página ofrece de $0 a $30.000)
            if (data.propina < 0 || data.propina > 100000 || data.propina != decimal.Truncate(data.propina))
                return BadRequest(new { mensaje = "La propina no es válida." });

            var metodo = MetodosPagoCliente.FirstOrDefault(m => string.Equals(m, data.metodoPago?.Trim(), StringComparison.OrdinalIgnoreCase));

            if (metodo == null)
                return BadRequest(new { mensaje = "Elige el método de pago." });

            var tarifa = _context.ubicacion_servicios
                .Where(u => u.id_ubicacion == ingreso.id_ubicacion)
                .Select(u => (decimal?)u.valor_servicio)
                .FirstOrDefault() ?? 0;

            // La solicitud, igual que SolicitarVehiculo: usuario_solicitud null = el cliente desde su enlace, y el
            // estado anterior para poder reversarla (punto 21)
            ingreso.estado_antes_solicitud = ingreso.estado_servicio;
            ingreso.usuario_solicitud = null;
            ingreso.solicitud_cliente = true;
            ingreso.fecha_solicitud = DateTime.Now;
            ingreso.estado_servicio = "solicitado";
            ingreso.fecha_fin_servicio = DateTime.Now.AddMinutes(20);
            ingreso.lugar_entrega = lugarEntrega;

            // El pago, igual que GuardarPago
            ingreso.valor_servicio = tarifa;
            ingreso.valor_propina = data.propina;
            ingreso.total_servicio = tarifa + data.propina;
            ingreso.metodo_pago = metodo;
            ingreso.estado_pago = "solicitado";

            // Una sola escritura: queda pedido con su pago, o no queda nada
            _context.SaveChanges();

            return Ok(new { mensaje = "Vehículo solicitado", fechaFinServicio = ingreso.fecha_fin_servicio?.ToString("O"), total = ingreso.total_servicio, metodo });
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
        [HttpGet]
        public IActionResult ObtenerEstadoIngreso(int id)
        {
            var ingreso = _context.ingresos
                .FirstOrDefault(i => i.id_ingreso == id);

            if (ingreso == null)
                return Json(new { success = false });

            return Json(new
            {
                success = true,
                idConsulta = ingreso.id_ingreso,
                estadoServicio = ingreso.estado_servicio,
                estadoPago = ingreso.estado_pago,
                // Solo se envía el código mientras no haya vencido
                codigo = ingreso.fecha_expiracion_codigo > DateTime.Now ? ingreso.codigo_seguridad : null,
                fechaFinServicio = ingreso.fecha_fin_servicio?.ToString("O"), // ISO 8601
                lugarEntrega = ingreso.lugar_entrega
            });
        }

        [HttpPost]
        [AllowAnonymous]
        public IActionResult GuardarPago(int idIngreso, decimal tarifa, decimal propina, string metodoPago)
        {
            try
            {
                var ingreso = _context.ingresos.FirstOrDefault(i => i.id_ingreso == idIngreso);
                if (ingreso == null)
                    return BadRequest(new { success = false, message = "Ingreso no encontrado" });

                decimal total = tarifa + propina;

                ingreso.valor_servicio = tarifa;
                ingreso.valor_propina = propina;
                ingreso.total_servicio = total;
                ingreso.metodo_pago = metodoPago;
                ingreso.estado_pago = "solicitado";

                // ← NUEVO: guardar cuándo vence el temporizador de 20 min
                // Solo si no fue guardado antes (por si el cliente recarga y vuelve a llamar)
                if (ingreso.fecha_fin_servicio == null)
                    ingreso.fecha_fin_servicio = DateTime.Now.AddMinutes(20);

                _context.SaveChanges();

                System.Diagnostics.Debug.WriteLine($"=== PAGO GUARDADO ===");
                System.Diagnostics.Debug.WriteLine($"ID: {idIngreso} | Total: {total} | Método: {metodoPago}");
                System.Diagnostics.Debug.WriteLine($"Fecha fin servicio: {ingreso.fecha_fin_servicio}");

                return Ok(new
                {
                    success = true,
                    message = "Pago guardado exitosamente",
                    total = total,
                    metodo = metodoPago,
                    // ← devolver la fecha al cliente también por si acaso
                    fechaFinServicio = ingreso.fecha_fin_servicio?.ToString("O")
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error guardando pago: {ex.Message}");
                return BadRequest(new { success = false, message = "Error al guardar el pago" });
            }
        }

        // Lugares de entrega: las ubicaciones activas de la zona del carro (sp_ubicacionesServicio, en orden
        // alfabético). Sin carro o sin zona, todas
        [HttpGet]
        public IActionResult ObtenerUbicaciones(int? idIngreso)
        {
            try
            {
                var zona = _context.ingresos
                    .Where(i => i.id_ingreso == idIngreso)
                    .Select(i => i.id_zona ?? (i.Ubicacion != null ? i.Ubicacion.id_zona : null))
                    .FirstOrDefault();

                var ubicaciones = _context.ubicacion_servicios
                    .FromSqlRaw("EXEC sp_ubicacionesServicio @id_zona", new SqlParameter("@id_zona", (object?)zona ?? DBNull.Value))
                    .AsEnumerable()
                    .Select(u => new
                    {
                        id = u.id_ubicacion,
                        nombre = u.nombre_ubicacion
                    })
                    .ToList();

                return Json(new
                {
                    success = true,
                    data = ubicaciones
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error obteniendo ubicaciones: {ex.Message}");

                return Json(new
                {
                    success = false,
                    message = "No fue posible obtener las ubicaciones."
                });
            }
        }
    }
}
