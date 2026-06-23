using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_sesiones")]
    public class sesiones
    {
        [Key]
        public int id_sesion { get; set; }

        // Relación con usuario
        public int id_usuario { get; set; }

        [ForeignKey("id_usuario")]
        public usuarios? Usuario { get; set; }

        // Rol usado en la sesión
        public int id_rol { get; set; }

        [ForeignKey("id_rol")]
        public roles? Rol { get; set; }

        // Lugar de trabajo
        public int? id_parqueadero { get; set; }

        [ForeignKey("id_parqueadero")]
        public parqueaderos? Parqueadero { get; set; }

        public int? id_ubicacion { get; set; }

        [ForeignKey("id_ubicacion")]
        public ubicacion_servicios? Ubicacion { get; set; }

        // Fecha y hora de inicio
        public DateTime fecha_inicio { get; set; }

        // Fecha y hora de salida
        public DateTime? fecha_fin { get; set; }

        public bool estado_liquidacion { get; set; }
    }
}