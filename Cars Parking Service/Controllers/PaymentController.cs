using AspNetCoreGeneratedDocument;
using CarsParkingService.Data;
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

            var ubicacion_Servicio = _context.ubicacion_servicios.Where(u => u.id_ubicacion == ingreso.id_ubicacion).FirstOrDefault();
            ViewBag.tarifa = ubicacion_Servicio.valor_servicio;

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

            ingreso.estado_servicio = "solicitado";
            ingreso.fecha_fin_servicio = fechaFinServicio;

            _context.SaveChanges(); // ⚠️ te faltaba esto

            return Ok(new { mensaje = "Actualizado correctamente", fechaFinServicio = ingreso.fecha_fin_servicio });
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
                estadoPago = ingreso.estado_pago,
                codigo = ingreso.codigo_seguridad,
                // ← NUEVO: enviar fecha para restaurar el temporizador
                fechaFinServicio = ingreso.fecha_fin_servicio?.ToString("O") // ISO 8601
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
    }
}
