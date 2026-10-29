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
        
    }
    
}