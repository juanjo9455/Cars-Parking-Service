using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models

{
    [Table("tbl_configuraciones")]
    public class configuraciones
    {
        [Key]
        public int id_configuracion { get; set; }
        public string clave { get; set; }
        public string valor { get; set; }
    }
}
