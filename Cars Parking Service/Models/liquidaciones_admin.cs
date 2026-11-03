namespace CarsParkingService.Models
{
    // Resultados de Database/liquidaciones-admin.sql (página Liquidaciones del administrador).
    // No son tablas: se leen con Database.SqlQueryRaw, como estados_filtro_ingresos

    // Una fila de sp_consultarLiquidaciones
    public class liquidacion_consulta
    {
        public int id_liquidacion { get; set; }
        public DateTime? fecha { get; set; }
        public int? id_usuario { get; set; }

        // Nombre y apellido de quien liquidó; vacío si el usuario ya no existe
        public string funcionario { get; set; } = "";

        public decimal total_efectivo { get; set; }
        public decimal total_transferencias { get; set; }
        public decimal total_liquidado { get; set; }
        public int total_vehiculos { get; set; }
    }

    // Una fila de sp_vehiculosLiquidacion: un vehículo de la liquidación
    public class vehiculo_liquidado
    {
        public string? placa { get; set; }
        public DateTime? fecha_entrega { get; set; }

        // Quién lo cobró; vacío si el usuario ya no existe
        public string cobro { get; set; } = "";

        public string? rol_cobrador { get; set; }
        public string? metodo_pago { get; set; }
        public decimal valor_servicio { get; set; }
        public string? nombre_ubicacion { get; set; }
    }

    // Una fila de sp_funcionariosLiquidaciones: un funcionario para el filtro
    public class funcionario_liquidacion
    {
        public int id_usuario { get; set; }
        public string funcionario { get; set; } = "";
    }
}
