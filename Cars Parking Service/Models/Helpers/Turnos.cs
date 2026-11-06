using CarsParkingService.Data;
using CarsParkingService.Models;

namespace CarsParkingService.Helpers
{
    // Turnos de los bancos (Database/turnos.sql). La jornada empieza a las 6 am: lo que pasa entre las 12 y las
    // 6 am es de la jornada anterior (la madrugada del jueves termina el viernes). Las mismas cuentas que hace
    // fn_vehiculosPorRecibir en la base
    public static class Turnos
    {
        private const int HoraInicioJornada = 6;

        public static DateTime Jornada(DateTime momento) => momento.AddHours(-HoraInicioJornada).Date;

        // 1 = lunes ... 7 = domingo
        private static int DiaSemana(DateTime dia) => dia.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)dia.DayOfWeek;

        private static bool EsMadrugada(turnos t) => t.hora_inicio.Hours < HoraInicioJornada;

        public static DateTime Inicio(turnos t, DateTime jornada) => jornada.AddDays(EsMadrugada(t) ? 1 : 0) + t.hora_inicio;

        public static DateTime Fin(turnos t, DateTime jornada) => jornada.AddDays(EsMadrugada(t) ? 1 : 0) + t.hora_fin;

        // El turno de quien entra ahora: el que está corriendo o, si todavía no empieza ninguno, el próximo de la
        // jornada. Corrido no se da al entrar: lo toma el de Turno 1 que sigue trabajando después de la hora de
        // margen (sp_pasarACorrido). null = ya no queda turno hoy
        public static turnos? DeLaHora(ApplicationDbContext db, DateTime ahora)
        {
            var jornada = Jornada(ahora);
            var dia = DiaSemana(jornada);

            return db.turnos
                .Where(t => t.activo && t.nombre != "Corrido" && (t.dia_semana == null || t.dia_semana == dia))
                .AsEnumerable()
                .Where(t => Fin(t, jornada) > ahora)
                .OrderBy(t => Inicio(t, jornada))
                .FirstOrDefault();
        }
    }
}
