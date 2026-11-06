using CarsParkingService.Data;
using CarsParkingService.Models;


namespace CarsParkingService.Helpers
{
    
    public static class LiquidacionReglas
    {
        
        public static IQueryable<ingresos> PorLiquidar(ApplicationDbContext db, int idBanco)
        {

            return db.ingresos.Where(i => i.estado_pago == "pagado" &&
                                           i.fecha_entrega != null &&
                                           i.estado_liquidacion == false &&
                                           // Lo que cobro el mismo como banco o como admin (punto 31: antes
                                           // lo del admin quedaba fuera de toda liquidacion)
                                           ((i.usuario_cobro == idBanco &&
                                           (i.rol_cobrador == "banco" || i.rol_cobrador == "admin")) ||
                                           // Lo que cobraron los valets en la zona del turno del banco
                                           // (turnos de antes de las zonas: en su ubicacion)
                                           (i.rol_cobrador == "valet" &&
                                           db.sesiones.Any(s => s.id_usuario == idBanco &&
                                           s.id_rol == 2 &&
                                           (s.id_zona != null
                                               ? (i.id_zona == s.id_zona || (i.id_zona == null && i.Ubicacion != null && i.Ubicacion.id_zona == s.id_zona))
                                               : s.id_ubicacion == i.id_ubicacion) &&
                                           i.fecha_entrega >= s.fecha_inicio &&
                                           (s.fecha_fin == null || i.fecha_entrega <= s.fecha_fin)))));




        }

        public static bool EsEfectivo(ingresos i) => i.metodo_pago == "Efectivo";

        // Lo que entró de verdad por ese carro: el total con propina (cobros de antes sin total: servicio + propina)
        public static decimal Cobrado(ingresos i) =>
            (i.total_servicio ?? 0) > 0 ? i.total_servicio!.Value : (i.valor_servicio ?? 0) + (i.valor_propina ?? 0);

        // Cuentas de la liquidación, en este orden:
        // 1. Transferencias: lo que entró por QR o transferencia, con las propinas
        // 2. Propinas de esas transferencias: se le pagan a los valets con el efectivo
        // 3. Efectivo a entregar: el efectivo recibido (siempre sin propina) menos esas propinas
        // Total: vehículos × servicio, aparte. Si transferencias + efectivo a entregar no da el total (un QR
        // cobrado por menos de la tarifa), la diferencia queda a la vista
        public record Cuentas(int Vehiculos, decimal Transferencias, decimal Propinas, decimal EfectivoRecibido,
                              decimal EfectivoAEntregar, decimal Total, decimal Diferencia);

        public static Cuentas Calcular(IEnumerable<ingresos> ingresos)
        {
            var lista = ingresos.ToList();
            var transferencias = lista.Where(i => !EsEfectivo(i)).Sum(Cobrado);
            var propinas = lista.Where(i => !EsEfectivo(i)).Sum(i => i.valor_propina ?? 0);
            var efectivoRecibido = lista.Where(EsEfectivo).Sum(i => i.valor_servicio ?? 0);
            var efectivoAEntregar = efectivoRecibido - propinas;
            var total = lista.Sum(i => i.valor_servicio ?? 0);

            return new Cuentas(lista.Count, transferencias, propinas, efectivoRecibido, efectivoAEntregar, total,
                               transferencias + efectivoAEntregar - total);
        }

    }
    
}