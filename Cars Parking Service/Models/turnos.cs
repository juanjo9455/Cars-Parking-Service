using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    // Turno de trabajo (Database/turnos.sql). dia_semana: 1 = lunes ... 7 = domingo; null = todos los días.
    // Es el día de la jornada, que empieza a las 6 am: la madrugada del jueves (12 a 2 am) es el día 4
    [Table("tbl_turnos")]
    public class turnos
    {
        [Key]
        public int id_turno { get; set; }

        public string nombre { get; set; } = "";

        public byte? dia_semana { get; set; }

        public TimeSpan hora_inicio { get; set; }

        public TimeSpan hora_fin { get; set; }

        public int orden { get; set; }

        public bool activo { get; set; }
    }

    // Lo que devuelve sp_vehiculosPorRecibir: vehículos sin cobrar de un banco cuyo turno ya terminó
    public class vehiculo_por_recibir
    {
        public int id_ingreso { get; set; }
        public string? placa { get; set; }
        public string? estado_servicio { get; set; }
        public string? nombre_ubicacion { get; set; }
        public string banco_anterior { get; set; } = "";
        public string? turno_anterior { get; set; }
    }

    // Lo que devuelve sp_recibirVehiculos: cada vehículo pedido, si se recibió y, si no, quién lo tiene
    public class vehiculo_recibido
    {
        public int id_ingreso { get; set; }
        public string? placa { get; set; }
        public bool recibido { get; set; }
        public string banco_actual { get; set; } = "";
    }
}
