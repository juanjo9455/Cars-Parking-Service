using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Cars_Parking_Service.Models
{
    [Table("tbl_usuarios")]
    public class usuarios
    {
        [Key]
        public int id_usuario { get; set; }
        public string nombres { get; set; }

        public string apellidos { get; set; }

        public string dni { get; set; }

        public int edad { get; set; }

        public string contraseña { get; set; }

        public int id_rol { get; set; }

        public string telefono { get; set; }

        public string correo { get; set; }

        public string? imagen_usuario { get; set; }

        public bool estado { get; set; }
    }
}
