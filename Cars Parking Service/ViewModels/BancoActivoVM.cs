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

        // Los que registró ese banco en la fecha consultada (id_banco; los heredados siguen contando para quien los registró)
        public int VehiculosRecibidos { get; set; }

        public bool Liquidado { get; set; }

    }
}
