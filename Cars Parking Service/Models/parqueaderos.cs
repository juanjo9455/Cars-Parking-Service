using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_parqueaderos")]
    public class parqueaderos
    {
        [Key]
        public int id_parqueadero { get; set; }
        public string? direccion { get; set; }
        public string? ciudad { get; set; }
        public string? nombre_parqueadero { get; set; }
        public decimal tarifa { get; set; }
        public string estado { get; set; } = "activo";

        // Database/zonas.sql: zona a la que pertenece (null = sin zona, sale en todas)
        public int? id_zona { get; set; }
    }
}
