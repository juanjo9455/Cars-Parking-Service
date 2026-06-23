using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Mvc;
using CarsParkingService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop.Infrastructure;
using AspNetCoreGeneratedDocument;

namespace CarsParkingService.Controllers
{
    public class LiquidacionController : Controller
    {
        private const string RecoveryEmailSessionKey = "RecoveryEmail";
        private const string RecoveryCodeSessionKey = "RecoveryCode";
        private const string RecoveryExpirationSessionKey = "RecoveryCodeExpirationUtc";
        private const string RecoveryValidatedSessionKey = "RecoveryValidated";

        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public LiquidacionController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public class LiquidacionDTO
        {
            public int IdUsuario { get; set; }
            public int TotalVehiculos { get; set; }
            public decimal TotalEfectivo { get; set; }
            public decimal TotalTransferencia { get; set; }
            public decimal TotalDinero { get; set; }
        }

        public IActionResult Liquidacion()
        {

            var idUsuario = HttpContext.Session.GetInt32("id");
            var idRol = HttpContext.Session.GetInt32("id_rol");

            // buscamos el total de vehiculos, efectivo y transferencia para este banco

            if (!idUsuario.HasValue || idRol != 2)
            {
                return Forbid();
            }

            var ingresos = _context.ingresos
                .Where(i =>
                       i.id_banco == idUsuario.Value &&
                       i.estado_liquidacion == false &&
                       i.estado_pago == "pagado" &&
                       i.fecha_entrega != null)
                    .ToList();

            var totalVehiculos = ingresos.Count;

            var totalEfectivo = ingresos
                .Where(i =>
                       i.metodo_pago == "Efectivo")
                .Sum(i => i.valor_servicio);

            var totalTransferencia = ingresos
                .Where(i =>
                       i.metodo_pago == "Transferencia")
                .Sum(i => i.valor_servicio);

            var totalPropinas = ingresos
                .Sum(i => i.valor_propina ?? 0);

            var totalGeneral =
                totalEfectivo +
                totalTransferencia;

            ViewBag.totalVehiculos = totalVehiculos;
            ViewBag.totalEfectivo = totalEfectivo;
            ViewBag.TotalTransferencia = totalTransferencia;
            ViewBag.totalGeneral = totalGeneral;

            // Buscamos lo que los valet le deben al banco

            var idUbicacion = _context.sesiones
                .Where(s => s.id_usuario == idUsuario.Value && s.fecha_fin == null)
                .Select(s => s.id_ubicacion)
                .FirstOrDefault();

            Console.WriteLine("\n========== DEBUG UBICACION ==========");
            Console.WriteLine($"ID Usuario: {idUsuario}");
            Console.WriteLine($"ID Rol: {idRol}");
            Console.WriteLine($"ID Ubicacion: {idUbicacion}");
            Console.WriteLine("=====================================\n");

            var resumenValets = _context.ingresos
                .Where(i =>
                    i.id_ubicacion == idUbicacion &&
                    i.estado_pago == "pagado" &&
                    i.metodo_pago == "Efectivo" &&
                    i.rol_cobrador == "valet"
                )
                .Join(
                    _context.usuarios,
                    ingreso => ingreso.usuario_cobro,
                    usuario => usuario.id_usuario,
                    (ingreso, usuario) => new
                    {
                        usuario.id_usuario,
                        usuario.nombres,
                        usuario.apellidos,
                        ingreso.valor_servicio
                    }
                )
                .GroupBy(x => new { x.id_usuario, x.nombres, x.apellidos })
                .Select(g => new
                {
                    IdUsuario = g.Key.id_usuario,
                    NombreCompleto = g.Key.nombres + " " + g.Key.apellidos,
                    Vehiculos = g.Count(),
                    TotalEfectivo = g.Sum(x => x.valor_servicio)
                })
                .ToList();

            var totalValetsEfectivo = resumenValets.Sum(v => v.TotalEfectivo);

            ViewBag.totalValetsEfectivo = totalValetsEfectivo;
            ViewBag.valets = resumenValets;

            ViewBag.valets = resumenValets;

            return View(ingresos);
        }

        [HttpPost]
        public async Task<IActionResult> GuardarLiquidacion([FromBody] LiquidacionDTO liquidacion) {

            try
            {
                var nuevaLiquidacion = new liquidacion
                {

                    id_usuario = liquidacion.IdUsuario,
                    total_vehiculos = liquidacion.TotalVehiculos,
                    total_efectivo = liquidacion.TotalEfectivo,
                    total_transferencias = liquidacion.TotalTransferencia,
                    total_liquidado = liquidacion.TotalDinero,
                    fecha = DateTime.Now

                };

                _context.liquidaciones.Add(nuevaLiquidacion);

                await _context.SaveChangesAsync();

                // Buscamos los ingresos a liquidar 

                await _context.ingresos
                    .Where(i =>
                           i.id_banco == liquidacion.IdUsuario &&
                           i.estado_liquidacion == false &&
                           i.estado_pago == "pagado" &&
                           i.fecha_entrega != null)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(i => i.estado_liquidacion, true)
                    );

                await _context.sesiones
                    .Where(s => s.id_usuario == liquidacion.IdUsuario && s.estado_liquidacion == false && s.fecha_fin == null)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(s => s.estado_liquidacion, true)
                    );

                var ingresosActualizados = await _context.ingresos
                .Where(i =>
                       i.id_banco == liquidacion.IdUsuario &&
                       i.estado_liquidacion == false &&
                       i.estado_pago == "pagado" &&
                       i.fecha_entrega != null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(i => i.estado_liquidacion, true)
                );

                Console.WriteLine($"Ingresos liquidados: {ingresosActualizados}");

                return Json(new
                {

                    success = true,
                    mensaje = "Liquidación guardada correctamente"

                });

            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    mensaje = ex.Message
                });
            }

        }

    }
}