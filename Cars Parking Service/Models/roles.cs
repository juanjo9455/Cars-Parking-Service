using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_roles")]
    public class roles
    {
        [Key]
        public int id_rol { get; set; }
        public string nombre_rol { get; set; }
    }
}
