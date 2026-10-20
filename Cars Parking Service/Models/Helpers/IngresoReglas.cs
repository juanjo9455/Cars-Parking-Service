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

        // Se despacha lo que está parqueado y lo que el cliente ya pidió (mismo criterio del botón del Key)
        public static bool PuedeDespachar(ingresos ingreso)
        {
            var estado = ingreso.estado_servicio?.Trim().ToLower();

            return estado == "parqueado" || estado == "solicitado";
        }

        // Se cobra solo el vehículo despachado, con valet de despacho y sin pagar (punto 32).
        // La foto de parqueo no es requisito: si la tomaron, queda en Información
        public static bool PuedeCobrar(ingresos ingreso)
        {
            return ingreso.estado_servicio?.Trim().ToLower() == "despachado" &&
                   ingreso.valet_despacho != null &&
                   ingreso.estado_pago?.Trim().ToLower() != "pagado";
        }

        // Una solicitud se puede reversar mientras el vehículo siga solicitado (antes de despacharlo, punto 21)
        public static bool PuedeReversarSolicitud(ingresos ingreso)
        {
            return ingreso.estado_servicio?.Trim().ToLower() == "solicitado";
        }

        // Puede recibir valet el vehículo que no tiene y todavía no sale: el que espera valet, el que el
        // cliente pidió antes de que alguien lo tomara (solicitado) y el activo sin valet (datos viejos).
        public static bool PuedeRecibirValet(ingresos ingreso)
        {
            var estado = ingreso.estado_servicio?.Trim().ToLower();

            return ingreso.id_valet == null &&
                   (estado == "esperando valet" || estado == "solicitado" || estado == "activo");
        }
    }
}
