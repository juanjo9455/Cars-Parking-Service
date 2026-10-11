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
using CarsParkingService.Helpers;

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

            // buscamos el total de vehiculos, efectivo y transferencia para este banco

            if (!idUsuario.HasValue || !LiquidacionReglas.PorLiquidar(_context, idUsuario.Value).Any())
            {
                return RedirectToAction("Index", "Home");
            }

            var ingresos = LiquidacionReglas.PorLiquidar(_context, idUsuario.Value)
                .Include(i => i.Ubicacion).ToList();

            var totalVehiculos = ingresos.Count;

            var totalEfectivo = ingresos
                .Where(i =>
                       i.metodo_pago == "Efectivo")
                .Sum(i => i.valor_servicio ?? 0);

            var totalTransferencia = ingresos
                .Where(i =>
                       i.metodo_pago != "Efectivo")
                .Sum(i => i.valor_servicio ?? 0);

            var totalPropinas = ingresos
                .Sum(i => i.valor_propina ?? 0);

            var totalGeneral =
                totalEfectivo +
                totalTransferencia;

            var idsCobro = ingresos.Select(i => i.usuario_cobro).Distinct().ToList();

            var nombres = _context.usuarios
                .Where(u => idsCobro.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);  

            ViewBag.totalVehiculos = totalVehiculos;
            ViewBag.totalEfectivo = totalEfectivo;
            ViewBag.TotalTransferencia = totalTransferencia;
            ViewBag.totalGeneral = totalGeneral;

            // Desglose por ubicacion: subtotal y vehiculos de cada una
            
            var porUbicacion = ingresos
                .GroupBy(i => i.Ubicacion?.nombre_ubicacion ?? "Sin Ubicacion")
                .Select(g => new
                {
                    Ubicacion = g.Key,
                    Vehiculos = g.Count(),
                    Total = g.Sum(i => i.valor_servicio ?? 0),
                    Detalle = g
                        .OrderBy(i => i.fecha_entrega)
                        .Select(i => new
                        {
                            Placa = i.placa,
                            Hora = i.fecha_entrega,
                            Cobro = nombres.GetValueOrDefault(i.usuario_cobro ?? 0, "Desconocido")
                                    + " (" + i.rol_cobrador +")",
                            Metodo = i.metodo_pago,
                            Valor = i.valor_servicio ?? 0
                        })
                        .ToList()
                })
                .ToList();

            ViewBag.porUbicacion = porUbicacion;
            
            // Efectivo que cada valet debe entregar al banco
                       var resumenValets = ingresos
                .Where(i => i.rol_cobrador == "valet" && i.metodo_pago == "Efectivo")
                .GroupBy(i => i.usuario_cobro ?? 0)
                .Select(g => new
                {
                    IdUsuario = g.Key,
                    NombreCompleto = nombres.GetValueOrDefault(g.Key, "Desconocido"),
                    Vehiculos = g.Count(),
                    TotalEfectivo = g.Sum(i => i.valor_servicio ?? 0)
                })
                .ToList();

            ViewBag.totalValetsEfectivo = resumenValets.Sum(v => v.TotalEfectivo);
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