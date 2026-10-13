using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CarsParkingService.Models
{
    [Table("tbl_whatsapp_enviados")]
    public class whatsapp_enviados
    {
        [Key]
        public int id_whatsapp { get; set; }

        // Ingreso al que pertenece el mensaje
        public int? id_ingreso { get; set; }

        [ForeignKey("id_ingreso")]
        public ingresos? Ingreso { get; set; }

        public string? placa { get; set; }

        // Número al que se envió
        public string? telefono { get; set; }

        // "ingreso" o "reenvio"
        public string tipo { get; set; } = "ingreso";

        // Si Meta aceptó el mensaje
        public bool exito { get; set; }

        // Código HTTP que respondió Meta
        public int? codigo_respuesta { get; set; }

        // Id del mensaje en Meta (wamid)
        public string? id_mensaje_meta { get; set; }

        // Motivo cuando falla
        public string? error { get; set; }

        // Usuario que lo envió
        public int? id_usuario { get; set; }

        [ForeignKey("id_usuario")]
        public usuarios? Usuario { get; set; }

        public DateTime fecha_envio { get; set; } = DateTime.Now;
    }
}
