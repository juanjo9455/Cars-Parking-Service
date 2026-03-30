using Microsoft.EntityFrameworkCore;
using Cars_Parking_Service.Models;

namespace Cars_Parking_Service.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) 
            : base(options)
        {
        }
        public DbSet<usuarios> usuarios { get; set; }
        public DbSet<ubicacion_servicios> ubicacion_servicios { get; set; }
        public DbSet<roles> roles { get; set; }
        public DbSet<parqueaderos> parqueaderos { get; set; }
        public DbSet<ingresos> ingresos { get; set; }
        public DbSet<imagenes> imagenes { get; set; }
        public DbSet<configuraciones> configuraciones { get; set; }
    }
}
