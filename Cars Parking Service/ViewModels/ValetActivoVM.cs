using Microsoft.AspNetCore.Razor.Language.Intermediate;
using CarsParkingService.Models;

namespace CarsParkingService.ViewModels
{
    public class ValetActivoVM
    {

        public int IdUsuario { get; set; }

        public string Nombres { get; set; }

        public string Apellidos { get; set; }

        public decimal Deuda { get; set; }

        // Los que ese valet marcó como parqueados (usuario_parqueo)
        public int VehiculosParqueados { get; set; }

        public int VehiculosDespachados { get; set; }

    }
}
