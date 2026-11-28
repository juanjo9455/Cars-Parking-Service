using CarsParkingService.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace CarsParkingService.Services
{
    // Sección "Sms" de appsettings.json. Client y Key NO van ahí (el repositorio es público): van en
    // appsettings.Secretos.json, que no se sube a git y se publica con la app (Program.cs)
    public class SmsOptions
    {
        // Apagado, no manda ni registra nada. Se prende en appsettings.Secretos.json junto con las claves
        public bool Habilitado { get; set; }
        public string ApiUrl { get; set; } = "";
        public string Client { get; set; } = "";
        public string Key { get; set; } = "";
        // Onurix: 1 = transaccional (aviso de servicio, no publicidad); 0 = comercial (revisa el RNE)
        public bool Transaccional { get; set; } = true;
        // Texto del SMS: {placa} y {idIngreso} se reemplazan al enviar
        public string Mensaje { get; set; } = "";
    }

    public interface ISmsService
    {
        // SMS de "vehículo recibido" con el enlace para solicitarlo. Nunca lanza error: si falla, lo registra y
        // devuelve false
        Task<bool> EnviarIngresoAsync(int idIngreso, string placa, string? telefono);
    }

    // SMS por Onurix (POST {ApiUrl} con client, key, phone, sms e is-transactional), a la par del WhatsApp de ingreso.
    // Cada intento queda en tbl_sms_enviados (Database/sms-ingreso.sql). La key nunca va a los logs ni a la base
    public class SmsService : ISmsService
    {
        private const int Largo = 500;   // tamaño de mensaje y detalle en tbl_sms_enviados

        private readonly HttpClient _http;
        private readonly IOptionsMonitor<SmsOptions> _opciones;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SmsService> _logger;

        public SmsService(HttpClient http, IOptionsMonitor<SmsOptions> opciones, ApplicationDbContext context, ILogger<SmsService> logger)
        {
            _http = http;
            _opciones = opciones;
            _context = context;
            _logger = logger;
        }

        public async Task<bool> EnviarIngresoAsync(int idIngreso, string placa, string? telefono)
        {
            var op = _opciones.CurrentValue;

            if (!op.Habilitado)
            {
                return false;
            }

            var numero = NormalizarTelefono(telefono);
            var mensaje = ArmarMensaje(op.Mensaje, placa, idIngreso);

            if (string.IsNullOrWhiteSpace(op.ApiUrl) || string.IsNullOrWhiteSpace(op.Client) ||
                string.IsNullOrWhiteSpace(op.Key) || string.IsNullOrWhiteSpace(op.Mensaje))
            {
                await Registrar(idIngreso, placa, numero ?? telefono, mensaje, false, null, null, null, null,
                    "SMS sin configurar: falta ApiUrl, Client, Key o Mensaje");
                return false;
            }

            if (numero == null)
            {
                await Registrar(idIngreso, placa, telefono, mensaje, false, null, null, null, null,
                    "El número no sirve para SMS (celular de Colombia de 10 dígitos, o con + e indicativo)");
                return false;
            }

            try
            {
                using var formulario = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client"] = op.Client,
                    ["key"] = op.Key,
                    ["phone"] = numero,
                    ["sms"] = mensaje,
                    ["is-transactional"] = op.Transaccional ? "1" : "0"
                });

                using var peticion = new HttpRequestMessage(HttpMethod.Post, op.ApiUrl) { Content = formulario };
                peticion.Headers.Accept.ParseAdd("application/json");

                using var respuesta = await _http.SendAsync(peticion);
                var cuerpo = await respuesta.Content.ReadAsStringAsync();
                var r = LeerRespuesta(cuerpo);
                var exito = respuesta.IsSuccessStatusCode && r.CodigoError == null;

                if (!exito)
                {
                    _logger.LogWarning("SMS del ingreso {IdIngreso} no enviado: HTTP {Http}, error {Error}: {Mensaje}",
                        idIngreso, (int)respuesta.StatusCode, r.CodigoError, r.Detalle);
                }

                await Registrar(idIngreso, placa, numero, mensaje, exito, r.Id, r.Estado, r.Creditos, r.CodigoError,
                    exito ? null : $"HTTP {(int)respuesta.StatusCode}: {r.Detalle ?? "sin detalle"}");
                return exito;
            }
            catch (Exception ex)
            {
                // Sin conexión, tiempo agotado, etc. El mensaje de la excepción no trae la key (va en el cuerpo)
                _logger.LogWarning(ex, "SMS del ingreso {IdIngreso}: no se pudo llamar a Onurix", idIngreso);
                await Registrar(idIngreso, placa, numero, mensaje, false, null, null, null, null,
                    ex is TaskCanceledException ? "Onurix no respondió a tiempo" : $"No se pudo conectar con Onurix: {ex.Message}");
                return false;
            }
        }

        // Onurix pide el número con indicativo y sin "+". Los celulares de Colombia (10 dígitos que empiezan por 3) van
        // con 57; los de otro país ya vienen con + e indicativo (IngresoVehiculos). null si no sirve para SMS
        public static string? NormalizarTelefono(string? telefono)
        {
            if (string.IsNullOrWhiteSpace(telefono))
            {
                return null;
            }

            var digitos = new string(telefono.Where(char.IsDigit).ToArray());

            if (telefono.TrimStart().StartsWith('+'))
            {
                return digitos.Length is >= 8 and <= 15 ? digitos : null;
            }

            if (digitos.Length == 10 && digitos[0] == '3')
            {
                return "57" + digitos;
            }

            return digitos.Length == 12 && digitos.StartsWith("573") ? digitos : null;
        }

        // El texto de appsettings con la placa y el número del ingreso
        public static string ArmarMensaje(string plantilla, string placa, int idIngreso) =>
            (plantilla ?? "").Replace("{placa}", placa).Replace("{idIngreso}", idIngreso.ToString());

        private record Respuesta(string? Id, string? Estado, int? Creditos, int? CodigoError, string? Detalle);

        // Éxito: { "id", "status", "data": { "id", "state", "credits", ... } }. Error: { "error": código, "msg": "..." }
        private static Respuesta LeerRespuesta(string cuerpo)
        {
            try
            {
                using var json = JsonDocument.Parse(cuerpo);
                var raiz = json.RootElement;

                if (raiz.ValueKind != JsonValueKind.Object)
                {
                    return new Respuesta(null, null, null, null, Recortar(cuerpo));
                }

                var data = raiz.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Object ? d : (JsonElement?)null;

                return new Respuesta(
                    Texto(raiz, "id") ?? (data is { } a ? Texto(a, "id") : null),
                    data is { } b ? Texto(b, "state") : null,
                    data is { } c ? Entero(c, "credits") : null,
                    Entero(raiz, "error"),
                    Texto(raiz, "msg"));
            }
            catch (JsonException)
            {
                return new Respuesta(null, null, null, null, Recortar(cuerpo));
            }
        }

        private static string? Texto(JsonElement e, string nombre) =>
            !e.TryGetProperty(nombre, out var v) || v.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined ? null
            : v.ValueKind == JsonValueKind.String ? v.GetString() : v.GetRawText();

        private static int? Entero(JsonElement e, string nombre) =>
            !e.TryGetProperty(nombre, out var v) ? null
            : v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? n
            : v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var s) ? s
            : null;

        // Para que quepa en su columna de tbl_sms_enviados
        private static string? Recortar(string? texto, int maximo = Largo) =>
            string.IsNullOrEmpty(texto) ? null : texto.Length <= maximo ? texto : texto[..maximo];

        // tbl_sms_enviados por sp_registrarSms. Si falla (por ejemplo, falta correr Database/sms-ingreso.sql), solo
        // queda en el log: el ingreso sigue
        private async Task Registrar(int idIngreso, string placa, string? telefono, string mensaje, bool exito,
            string? idProveedor, string? estado, int? creditos, int? codigoError, string? detalle)
        {
            try
            {
                await _context.Database.ExecuteSqlRawAsync(
                    "EXEC dbo.sp_registrarSms @id_ingreso, @placa, @telefono, @mensaje, @exito, @id_proveedor, @estado, @creditos, @codigo_error, @detalle, @fecha",
                    new SqlParameter("@id_ingreso", idIngreso),
                    new SqlParameter("@placa", (object?)Recortar(placa, 20) ?? DBNull.Value),
                    new SqlParameter("@telefono", (object?)Recortar(telefono, 20) ?? DBNull.Value),
                    new SqlParameter("@mensaje", (object?)Recortar(mensaje) ?? DBNull.Value),
                    new SqlParameter("@exito", exito),
                    new SqlParameter("@id_proveedor", (object?)idProveedor ?? DBNull.Value),
                    new SqlParameter("@estado", (object?)estado ?? DBNull.Value),
                    new SqlParameter("@creditos", (object?)creditos ?? DBNull.Value),
                    new SqlParameter("@codigo_error", (object?)codigoError ?? DBNull.Value),
                    new SqlParameter("@detalle", (object?)Recortar(detalle) ?? DBNull.Value),
                    new SqlParameter("@fecha", System.Data.SqlDbType.DateTime2) { Value = DateTime.Now });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo registrar el SMS del ingreso {IdIngreso} en tbl_sms_enviados", idIngreso);
            }
        }
    }
}
