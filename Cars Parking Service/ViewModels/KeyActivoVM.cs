using Microsoft.AspNetCore.Razor.Language.Intermediate;
using CarsParkingService.Models;

namespace CarsParkingService.ViewModels
{
    public class KeyActivoVM
    {

        public int IdUsuario { get; set; }

        public string Nombres { get; set; }

        public string Apellidos { get; set; }

        public string Parqueadero { get; set; }

        public int CarrosEstacionados { get; set; }

    }
}
