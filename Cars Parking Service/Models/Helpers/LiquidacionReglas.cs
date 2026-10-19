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
                                           (i.rol_cobrador == "valet" &&
                                           db.sesiones.Any(s => s.id_usuario == idBanco &&
                                           s.id_rol == 2 &&
                                           s.id_ubicacion == i.id_ubicacion &&
                                           i.fecha_entrega >= s.fecha_inicio &&
                                           (s.fecha_fin == null || i.fecha_entrega <= s.fecha_fin)))));
            
                                           


        }
        
    }
    
}