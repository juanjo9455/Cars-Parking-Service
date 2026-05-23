using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.ExceptionServices;

namespace CarsParkingService.Models
{
    [Table("tbl_ingresos")]
    public class ingresos
    {
        [Key]
        public int id_ingreso { get; set; }
        public string? placa { get; set; }
        public DateTime? fecha_ingreso { get; set; }
        public DateTime? fecha_salida { get; set; }
        public string? estado_pago { get; set; }
        public string? estado_servicio { get; set; }
        public int id_valet { get; set; }
        [ForeignKey("id_valet")]
        public usuarios? Valet { get; set; }

        public int id_banco { get; set; }
        [ForeignKey("id_banco")]
        public usuarios? Banco { get; set; }

        public int id_parqueadero { get; set; }
        [ForeignKey("id_parqueadero")]
        public parqueaderos? Parqueadero { get; set; }

        public int id_ubicacion { get; set; }
        [ForeignKey("id_ubicacion")]
        public ubicacion_servicios? Ubicacion { get; set; }
        public string? notas { get; set; }
        public byte[]? firma { get; set; }
        public decimal? valor_servicio { get; set; }
        public decimal? valor_propina { get; set; }
        public string? telefono { get; set; }
        public string? nombre_cliente { get; set; }
        public DateTime? fecha_fin_servicio { get; set; }
    }

    public class SolicitudDto
    {
        public int idIngreso { get; set; }
    }
}
