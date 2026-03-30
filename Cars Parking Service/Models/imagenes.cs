using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cars_Parking_Service.Models
{
    [Table("tbl_imagenes")]
    public class imagenes
    {
        [Key]
        public int id_imagen { get; set; }
        public byte[] dato_imagen { get; set; }

        public int id_ingreso { get; set; }
        [ForeignKey("id_ingreso")]
        public ingresos ingreso { get; set; }
    }
}
