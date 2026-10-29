using CarsParkingService.Data;
using CarsParkingService.Models;

namespace CarsParkingService.Helpers
{
    public static class SesionTurno
    {
        // Cierra el turno abierto del usuario y abre uno nuevo con el rol, la zona y el lugar indicados.
        // Lo usan el login (AuthController.cambiarRol, al escoger rol y zona) y el Key cuando cambia de
        // parqueadero en su vista (CambiarParqueaderoVista).
        public static void AbrirTurno(ApplicationDbContext db, HttpContext http, int idUsuario,
            int idRol, int? idUbicacion, int? idParqueadero, int? idZona)
        {
            // 1. Cerrar los turnos abiertos (tbl_sesiones)
            var sesionesAbiertas = db.sesiones
                .Where(s => s.id_usuario == idUsuario && s.fecha_fin == null)
                .ToList();

            foreach (var s in sesionesAbiertas)
            {
                s.fecha_fin = DateTime.Now;
            }

            // 2. Abrir el turno nuevo: Banco guarda ubicación, Key guarda parqueadero
            db.sesiones.Add(new sesiones
            {
                id_usuario = idUsuario,
                id_rol = idRol,
                id_ubicacion = idRol == 2 ? idUbicacion : null,
                id_parqueadero = idRol == 4 ? idParqueadero : null,
                id_zona = idZona,
                fecha_inicio = DateTime.Now,
                ultima_actividad = DateTime.Now,
                fecha_fin = null
            });

            db.SaveChanges();

            // 3. Sesión web: rol del turno y solo el lugar que aplica
            http.Session.SetInt32("id_rol", idRol);
            http.Session.Remove("id_ubicacion");
            http.Session.Remove("id_parqueadero");
            http.Session.Remove("id_zona");

            if (idZona.HasValue)
            {
                http.Session.SetInt32("id_zona", idZona.Value);
            }

            if (idRol == 2 && idUbicacion.HasValue)
            {
                http.Session.SetInt32("id_ubicacion", idUbicacion.Value);
            }

            if (idRol == 4 && idParqueadero.HasValue)
            {
                http.Session.SetInt32("id_parqueadero", idParqueadero.Value);
            }
        }
    }
}
