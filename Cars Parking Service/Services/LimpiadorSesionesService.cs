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
            _logger.LogInformation("Servicio de limpieza de sesiones con 'UltimaActividad' iniciado.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); // Cambia por tu DbContext

                        // Consideramos inactiva una sesión que no reporte actividad en 3 minutos
                        var limiteInactividad = DateTime.Now.AddMinutes(-3);

                        // Obtenemos las sesiones sin fecha_fin cuya última actividad sea mayor a 3 minutos
                        var sesionesExpiradas = await db.TblSesiones
                            .Where(s => s.FechaFin == null && s.UltimaActividad < limiteInactividad)
                            .ToListAsync(stoppingToken);

                        if (sesionesExpiradas.Any())
                        {
                            foreach (var sesion in sesionesExpiradas)
                            {
                                // La fecha fin será exactamente la última hora en la que estuvo activo
                                sesion.FechaFin = sesion.UltimaActividad;
                            }

                            await db.SaveChangesAsync(stoppingToken);
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
