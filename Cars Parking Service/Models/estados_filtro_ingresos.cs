namespace CarsParkingService.Models
{
    // Una fila de sp_estadosFiltroIngresos: un estado del filtro de la tabla de ingresos.
    // No es tabla: se lee con Database.SqlQueryRaw
    public class estados_filtro_ingresos
    {
        // Lo que se guarda en tbl_ingresos.estado_servicio
        public string valor { get; set; } = "";

        // Lo que ve el operador en el filtro
        public string nombre { get; set; } = "";

        // Va marcado al entrar a la tabla (y con Limpiar)
        public bool por_defecto { get; set; }
    }
}
