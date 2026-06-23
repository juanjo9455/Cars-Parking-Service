using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_liquidacion")]
    public class liquidacion
    {
        [Key]
        public int id_liquidacion { get; set; }

        public DateTime? fecha { get; set; }

        [ForeignKey("Usuario")]
        public int? id_usuario { get; set; }

        public int? total_vehiculos { get; set; }

        public decimal? total_efectivo { get; set; }

        public decimal? total_transferencias { get; set; }

        public decimal? total_liquidado { get; set; }

        // Navegación
        public virtual usuarios? Usuario { get; set; }
    }
}