using AspNetCoreGeneratedDocument;
using Cars_Parking_Service.Data;
using Cars_Parking_Service.Models;
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

        public IActionResult Estado_Servicio()
        {
            // ============================================
            // TODO: BACKEND COMENTADO PARA DESARROLLO
            // ============================================
            // Esta lógica está comentada porque estamos
            // desarrollando primero la interfaz visual
            // 
            // Cuando esté lista, descomenta esto y 
            // actualiza según el flujo correcto del negocio
            // ============================================

            // Pasar datos HARDCODEADOS para desarrollo
            var ingresoMockup = new ingresos
            {
                id_ingreso = 12345,
                placa = "ABC123",
                fecha_ingreso = DateTime.Now,
                fecha_salida = null,
                valor_servicio = 3500,
                valor_propina = 0,
                id_valet = 1
            };

            var valetMockup = new usuarios
            {
                id_usuario = 1,
                nombres = "Carlos",
                telefono = "3011106690",
                imagen_usuario = null
            };

            ViewBag.Ingreso = ingresoMockup;
            ViewBag.Valet = valetMockup;

            return View();

            /* ============================================
            // CÓDIGO ORIGINAL (COMENTADO)
            // ============================================

            // TODO: MEJORAR FLUJO DE PAGO
            // ============================================
            // PROBLEMA ACTUAL:
            // - Solo busca ingreso donde id_valet == usuario logueado
            // - Esto significa que SOLO el valet puede ver la página
            // - Pero el pago lo hace el CLIENTE, no el valet
            // 
            // FLUJO CORRECTO DEBERÍA SER:
            // 1. Cliente llama a pedir vehículo
            // 2. Sistema asigna un valet disponible (id_valet)
            // 3. Valet ingresa vehículo en sistema (crea INGRESO)
            // 4. Cliente recibe enlace o QR con ID del INGRESO
            // 5. Cliente accede a "Estado_Servicio" pasando el ID_INGRESO
            // 6. Sistema muestra factura con datos del valet y totales
            // 7. Cliente PAGA
            // 8. Sistema marca INGRESO como pagado
            //
            // CAMBIOS NECESARIOS:
            // - Pasar id_ingreso como parámetro de URL
            // - No usar id_valet del usuario logueado para búsqueda
            // - Permitir ver factura sin estar logueado (o con rol diferente)
            // ============================================

            // Obtener el ID del usuario de la sesión
            var idUsuario = HttpContext.Session.GetInt32("id");
            var rolUsuario = HttpContext.Session.GetInt32("id_rol");

            if (!idUsuario.HasValue)
            {
                return RedirectToAction("Login", "Auth");
            }

            // Obtener el ingreso activo del usuario (como valet)
            // TODO: Cambiar esto para buscar por id_ingreso en lugar de id_valet
            var ingresoActivo = _context.ingresos
                .Where(i => i.id_valet == idUsuario && i.estado_servicio == "activo")
                .OrderByDescending(i => i.fecha_ingreso)
                .FirstOrDefault();

            if (ingresoActivo == null)
            {
                // Si no hay ingreso activo, redirigir a la tabla de vehículos
                TempData["Mensaje"] = "No hay un servicio activo en este momento. Por favor, registra un nuevo ingreso de vehículo.";
                return RedirectToAction("Tabla_Vehiculos", "Home");
            }

            // Obtener la información del valet (usuario que ingresó el vehículo)
            var valet = _context.usuarios
                .FirstOrDefault(u => u.id_usuario == ingresoActivo.id_valet);

            // Pasar los datos a la vista
            ViewBag.Ingreso = ingresoActivo;
            ViewBag.Valet = valet;

            return View();
            ============================================ */
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        // ============================================
        // COMENTADO PARA DESARROLLO FRONTEND
        // ============================================
        // Este método estaba bloqueando el acceso a la página
        // durante la fase de desarrollo del UI.
        // Descomenta cuando implementes autenticación real.
        // ============================================

        /* 
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
        */
    }
}
