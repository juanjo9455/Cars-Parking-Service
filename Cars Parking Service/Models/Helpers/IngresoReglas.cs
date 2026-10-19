using CarsParkingService.Models;

namespace CarsParkingService.Helpers
{
    // Reglas del ingreso que usan el servidor y las vistas. Así el botón que se ve y la validación
    // del servidor no se pueden separar, como pasó con el refresco de VistaKey.
    public static class IngresoReglas
    {
        // Solo se parquea un vehículo activo y con valet asignado. Así también quedan por fuera el que
        // espera valet, el solicitado (se perdería la solicitud) y el que ya está parqueado o despachado.
        public static bool PuedeParquear(ingresos ingreso)
        {
            return ingreso.id_valet != null &&
                   ingreso.estado_servicio?.Trim().ToLower() == "activo";
        }
    }
}
