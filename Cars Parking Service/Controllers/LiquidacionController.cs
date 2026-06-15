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

    }
}