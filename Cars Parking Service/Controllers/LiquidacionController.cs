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

            // Transferencias, propinas, efectivo a entregar y total: las mismas cuentas que guarda GuardarLiquidacion
            var cuentas = LiquidacionReglas.Calcular(ingresos);

            var idsCobro = ingresos.Select(i => i.usuario_cobro).Distinct().ToList();

            var nombres = _context.usuarios
                .Where(u => idsCobro.Contains(u.id_usuario))
                .ToDictionary(u => u.id_usuario, u => u.nombres + " " + u.apellidos);  

            ViewBag.cuentas = cuentas;
            ViewBag.totalVehiculos = cuentas.Vehiculos;
            ViewBag.totalGeneral = cuentas.Total;

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
                            Valor = i.valor_servicio ?? 0,
                            // En efectivo nunca hay propina: lo que entra es el servicio
                            Propina = LiquidacionReglas.EsEfectivo(i) ? 0 : i.valor_propina ?? 0,
                            Cobrado = LiquidacionReglas.EsEfectivo(i) ? i.valor_servicio ?? 0 : LiquidacionReglas.Cobrado(i)
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
        public async Task<IActionResult> GuardarLiquidacion()
        {
            // El banco sale de la sesión, no de lo que mande el navegador
            var idUsuario = HttpContext.Session.GetInt32("id");

            if (!idUsuario.HasValue)
            {
                return Json(new { success = false, mensaje = "Sesión expirada, vuelve a iniciar sesión." });
            }

            // Mismos ingresos que muestra la pantalla de liquidación
            var ingresos = await LiquidacionReglas.PorLiquidar(_context, idUsuario.Value).ToListAsync();

            if (ingresos.Count == 0)
            {
                return Json(new { success = false, mensaje = "No hay servicios pendientes por liquidar." });
            }

            // Las mismas cuentas que muestra la pantalla (LiquidacionReglas.Calcular): efectivo = el que se entrega,
            // ya sin las propinas de QR; transferencias = con propinas; total = vehículos × servicio
            var cuentas = LiquidacionReglas.Calcular(ingresos);

            // O se guarda todo, o no se guarda nada
            using var transaccion = await _context.Database.BeginTransactionAsync();

            try
            {
                var nuevaLiquidacion = new liquidacion
                {
                    id_usuario = idUsuario.Value,
                    total_vehiculos = cuentas.Vehiculos,
                    total_efectivo = cuentas.EfectivoAEntregar,
                    total_transferencias = cuentas.Transferencias,
                    total_liquidado = cuentas.Total,
                    fecha = DateTime.Now
                };

                _context.liquidaciones.Add(nuevaLiquidacion);
                await _context.SaveChangesAsync();   // aquí la BD le asigna su id_liquidacion

                // Marcamos exactamente los ingresos que se sumaron
                foreach (var ingreso in ingresos)
                {
                    ingreso.estado_liquidacion = true;
                    ingreso.id_liquidacion = nuevaLiquidacion.id_liquidacion;
                }

                // Estado Turnos usa esta marca para mostrar el turno como liquidado
                var sesionAbierta = await _context.sesiones
                    .FirstOrDefaultAsync(s => s.id_usuario == idUsuario.Value && s.fecha_fin == null);

                if (sesionAbierta != null)
                {
                    sesionAbierta.estado_liquidacion = true;
                }

                await _context.SaveChangesAsync();
                await transaccion.CommitAsync();

                return Json(new { success = true, mensaje = "Liquidación guardada correctamente" });
            }
            catch (Exception ex)
            {
                await transaccion.RollbackAsync();
                return Json(new { success = false, mensaje = ex.Message });
            }
        }


    }
}