using Microsoft.AspNetCore.Razor.Language.Intermediate;
using CarsParkingService.Models;

namespace CarsParkingService.ViewModels
{
    public class EstadoTurnosViewModel
    {

        public DateTime FechaHoy { get; set; }

        public List<ValetActivoVM> Valets { get; set; } = new();

        public List<BancoActivoVM> Bancos { get; set; } = new();

        public List<KeyActivoVM> Keys { get; set; } = new();

        // Liquidaciones hechas en la fecha consultada (no dependen de la sesión abierta)
        public List<LiquidacionDiaVM> Liquidaciones { get; set; } = new();

    }
}
