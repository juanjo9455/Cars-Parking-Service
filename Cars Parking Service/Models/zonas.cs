using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    // Zona de trabajo (Database/zonas.sql): agrupa ubicaciones de servicio y parqueaderos.
    // Cada operador escoge la suya al entrar y solo ve lo de esa zona
    [Table("tbl_zonas")]
    public class zonas
    {
        [Key]
        public int id_zona { get; set; }
        public string nombre_zona { get; set; } = "";
        public string estado { get; set; } = "activo";
    }
}
