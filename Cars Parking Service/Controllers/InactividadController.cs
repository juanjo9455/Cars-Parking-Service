using CarsParkingService.Data;
using Microsoft.AspNetCore.Mvc;

namespace CarsParkingService.Controllers
{
    // Cierre de sesión por 2 horas sin actividad (wwwroot/js/inactividad.js). Va aparte de HomeController porque su
    // filtro manda al login a quien ya no tiene sesión, y aquí el aviso también tiene que llegar en ese caso
    // (celular bloqueado más de 2 horas: la sesión web ya venció).
    // No revisa cobros sin liquidar, igual que el limpiador: quedan pendientes a su nombre para cuando vuelva a entrar
    public class InactividadController : Controller
    {
        private readonly ApplicationDbContext _context;

        public InactividadController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public IActionResult Cerrar()
        {
            var idUsuario = HttpContext.Session.GetInt32("id");

            if (idUsuario.HasValue)
            {
                // Como LimpiadorSesionesService: el turno termina a la hora de la última actividad
                var turnosAbiertos = _context.sesiones
                    .Where(s => s.id_usuario == idUsuario.Value && s.fecha_fin == null)
                    .ToList();

                foreach (var turno in turnosAbiertos)
                {
                    turno.fecha_fin = turno.ultima_actividad ?? DateTime.Now;
                }

                _context.SaveChanges();
            }

            HttpContext.Session.Clear();
            TempData["Mensaje"] = "Tu sesión se cerró por 2 horas sin actividad. Vuelve a ingresar.";

            return NoContent();
        }
    }
}
