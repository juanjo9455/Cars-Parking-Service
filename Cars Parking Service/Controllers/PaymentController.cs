using AspNetCoreGeneratedDocument;
using Cars_Parking_Service.Data;
using Cars_Parking_Service.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop.Infrastructure;
using System.Diagnostics;

namespace Cars_Parking_Service.Controllers
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

    }
}
