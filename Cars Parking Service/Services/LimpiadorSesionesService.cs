using CarsParkingService.Data; // Asegúrate de ajustar el namespace de tu ApplicationDbContext si es necesario
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CarsParkingService.Services
{
    public class LimpiadorSesionesService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LimpiadorSesionesService> _logger;

        public LimpiadorSesionesService(
            IServiceProvider serviceProvider,
            ILogger<LimpiadorSesionesService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Servicio de limpieza de sesiones con 'ultima_actividad' iniciado.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                        // Consideramos inactiva una sesión que no reporte actividad en 30 minutos (lo mismo que dura
                        // la sesión web). Con 3, bastaba bloquear el celular un rato para perder el turno, porque
                        // el navegador pausa el latido mientras la pantalla está apagada.
                        var limiteInactividad = DateTime.Now.AddMinutes(-30);

                        // Obtenemos las sesiones sin fecha_fin cuya última actividad sea anterior a ese límite
                        var sesionesExpiradas = await context.sesiones
                            .Where(s => s.fecha_fin == null && s.ultima_actividad < limiteInactividad)
                            .ToListAsync(stoppingToken);

                        if (sesionesExpiradas.Any())
                        {
                            foreach (var sesion in sesionesExpiradas)
                            {
                                // Asignamos fecha_fin igual a la última actividad registrada
                                sesion.fecha_fin = sesion.ultima_actividad;
                            }

                            // Corregido: context en lugar de db
                            await context.SaveChangesAsync(stoppingToken);
                            _logger.LogInformation($"[LimpiadorSesiones] Se cerraron {sesionesExpiradas.Count} sesiones inactivas.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en la verificación de sesiones inactivas.");
                }

                // El limpiador revisa la base de datos cada 2 minutos
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            }
        }
    }
}