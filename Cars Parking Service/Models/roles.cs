using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cars_Parking_Service.Models
{
    [Table("tbl_roles")]
    public class roles
    {
        [Key]
        public int id_rol { get; set; }
        public string nombre_rol { get; set; }
    }
}
