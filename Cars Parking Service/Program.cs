using CarsParkingService.Data;
using CarsParkingService.Services;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Latido del servicio de limpieza de sesiones (BackgroundService)
builder.Services.AddHostedService<LimpiadorSesionesService>();

// Aumenta el límite de tamaño de carga para Kestrel (200 MB, ajustable)
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 209_715_200; // 200 MB
});

// Aumenta el límite de tamaño de carga para formularios multipart (200 MB)
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 209_715_200; // 200 MB
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Agregar soporte para sesiones con configuración
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Comprime las respuestas (páginas, JSON y las filas que trae el refresco de VistaKey) para gastar
// menos datos en los celulares. EnableForHttps: el sitio corre en HTTPS y sin esto no comprimiría nada.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Va antes de los archivos estáticos y de los controladores para comprimir lo que ellos responden
app.UseResponseCompression();

app.UseStaticFiles();

app.UseRouting();

// ⚠️ IMPORTANTE: UseSession() debe estar DESPUÉS de UseRouting() y ANTES de UseAuthorization()
app.UseSession();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Auth}/{action=Login}/{id?}")
    .WithStaticAssets();

app.Run();
