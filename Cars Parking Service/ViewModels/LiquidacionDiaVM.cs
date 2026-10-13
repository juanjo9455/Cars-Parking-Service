namespace CarsParkingService.ViewModels
{
    // Una liquidación hecha en el día (pestaña Liquidaciones de Estado Turnos)
    public class LiquidacionDiaVM
    {

        public int IdLiquidacion { get; set; }

        public DateTime? Fecha { get; set; }

        // Quién liquidó
        public string Usuario { get; set; } = "";

        public int TotalVehiculos { get; set; }

        public decimal TotalEfectivo { get; set; }

        public decimal TotalTransferencias { get; set; }

        public decimal TotalLiquidado { get; set; }

    }
}
