using Microsoft.AspNetCore.Razor.Language.Intermediate;
using CarsParkingService.Models;

namespace CarsParkingService.ViewModels
{
    public class BancoActivoVM
    {

        public int IdUsuario { get; set; }

        public string Nombres { get; set; }

        public string Apellidos { get; set; }

        public string LugarActual { get; set; }

        public int VehiculosUbicacion { get; set; }

        public bool Liquidado { get; set; }

    }
}
