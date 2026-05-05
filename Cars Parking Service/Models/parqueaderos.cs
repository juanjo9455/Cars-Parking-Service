using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cars_Parking_Service.Models
{
    [Table("tbl_parqueaderos")]
    public class parqueaderos
    {
        [Key]
        public int id_parqueadero { get; set; }
        public string direccion { get; set; }
        public string ciudad { get; set; }
        public string nombre_parqueadero { get; set; }
        public decimal tarifa { get; set; }
        public string estado { get; set; } = "activo";
    }
}
