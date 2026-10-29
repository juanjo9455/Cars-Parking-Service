using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_ubicacion_servicios")]
    public class ubicacion_servicios
    {
        [Key]
        public int id_ubicacion { get; set; }
        public string? nombre_ubicacion { get; set; }
        public string? direccion { get; set; }
        public string? ciudad { get; set; }
        public decimal valor_servicio { get; set; }
        public string estado { get; set; } = "activo";

        // Database/zonas.sql: zona a la que pertenece (null = sin zona, sale en todas)
        public int? id_zona { get; set; }
    }
}
