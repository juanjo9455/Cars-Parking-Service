namespace CarsParkingService.Models
{
    // Lo que devuelve sp_cambiosIngresos (Database/ajustes-admin.sql): un cambio hecho a un vehículo, con quién lo
    // hizo. campo: metodo_pago, valor_total, valet, despacho, parqueo, banco, lugar_ingreso, lugar_entrega,
    // comprobante o cancelacion
    public class cambio_ingreso
    {
        public int id_ingreso { get; set; }
        public DateTime fecha { get; set; }
        public string campo { get; set; } = "";
        public string? antes { get; set; }
        public string? despues { get; set; }
        public string? motivo { get; set; }
        public string? usuario { get; set; }

        // Cómo se llama cada dato en pantalla
        public string Que => campo switch
        {
            "metodo_pago" => "Método de pago",
            "valor_total" => "Valor total",
            "valet" => "Valet",
            "despacho" => "Valet de despacho",
            "parqueo" => "Quién lo parqueó",
            "banco" => "Banco a cargo",
            "lugar_ingreso" => "Lugar de ingreso",
            "lugar_entrega" => "Lugar de entrega",
            "comprobante" => "Foto del comprobante",
            "cancelacion" => "Servicio cancelado",
            _ => campo
        };
    }
}
