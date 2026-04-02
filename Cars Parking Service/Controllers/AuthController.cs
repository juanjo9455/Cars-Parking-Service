using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using Cars_Parking_Service.Models;
using Microsoft.AspNetCore.Mvc;
using Cars_Parking_Service.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop.Infrastructure;
using AspNetCoreGeneratedDocument;

namespace Cars_Parking_Service.Controllers
{
    public class AuthController : Controller
    {
        private const string RecoveryEmailSessionKey = "RecoveryEmail";
        private const string RecoveryCodeSessionKey = "RecoveryCode";
        private const string RecoveryExpirationSessionKey = "RecoveryCodeExpirationUtc";
        private const string RecoveryValidatedSessionKey = "RecoveryValidated";

        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public IActionResult Login()
        {
            if (!string.IsNullOrEmpty(HttpContext.Session.GetString("dni")))
            {
                return RedirectToAction("Index", "Home");
            }

            HttpContext.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            HttpContext.Response.Headers["Pragma"] = "no-cache";
            HttpContext.Response.Headers["Expires"] = "-1";

            return View();
        }

        public IActionResult SingUp()
        {
            return View();
        }

        [HttpGet]
        public IActionResult ForgotPassword()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ForgotPassword(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                ViewBag.Error = "Debes ingresar un correo electrónico.";
                return View();
            }

            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.usuarios
                .FirstOrDefaultAsync(u => u.correo != null && u.correo.Trim().ToLower() == normalizedEmail && u.estado == true);

            var recoveryCode = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
            var expirationUtc = DateTime.UtcNow.AddMinutes(5);

            HttpContext.Session.SetString(RecoveryEmailSessionKey, normalizedEmail);
            HttpContext.Session.SetString(RecoveryCodeSessionKey, recoveryCode);
            HttpContext.Session.SetString(RecoveryExpirationSessionKey, expirationUtc.ToString("O"));
            HttpContext.Session.Remove(RecoveryValidatedSessionKey);

            if (user != null)
            {
                try
                {
                    await EnviarCodigoRecuperacionAsync(normalizedEmail, recoveryCode, expirationUtc);
                }
                catch (Exception)
                {
                    ViewBag.Error = "No fue posible enviar el correo de recuperación. Intenta nuevamente.";
                    return View();
                }
            }

            TempData["Mensaje"] = "Si el correo está registrado, se enviaron instrucciones de recuperación.";
            return RedirectToAction("CodeReset");
        }

        [HttpGet]
        public IActionResult CodeReset()
        {
            var recoveryEmail = HttpContext.Session.GetString(RecoveryEmailSessionKey);
            if (string.IsNullOrWhiteSpace(recoveryEmail))
            {
                TempData["Error"] = "Primero debes solicitar el código de recuperación.";
                return RedirectToAction("ForgotPassword");
            }

            ViewBag.RecoveryEmail = recoveryEmail;
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult CodeReset(string code)
        {
            var storedCode = HttpContext.Session.GetString(RecoveryCodeSessionKey);
            var expirationRaw = HttpContext.Session.GetString(RecoveryExpirationSessionKey);
            var recoveryEmail = HttpContext.Session.GetString(RecoveryEmailSessionKey);

            if (string.IsNullOrWhiteSpace(storedCode) ||
                string.IsNullOrWhiteSpace(expirationRaw) ||
                string.IsNullOrWhiteSpace(recoveryEmail))
            {
                TempData["Error"] = "La sesión de recuperación expiró. Solicita un nuevo código.";
                return RedirectToAction("ForgotPassword");
            }

            if (!DateTime.TryParse(
                    expirationRaw,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var expirationUtc))
            {
                TempData["Error"] = "No se pudo validar el tiempo del código. Solicita uno nuevo.";
                return RedirectToAction("ForgotPassword");
            }

            if (DateTime.UtcNow > expirationUtc)
            {
                TempData["Error"] = "El código expiró. Solicita uno nuevo.";
                return RedirectToAction("ForgotPassword");
            }

            if (string.IsNullOrWhiteSpace(code) || code.Trim() != storedCode)
            {
                ViewBag.Error = "El código ingresado no es válido.";
                ViewBag.RecoveryEmail = recoveryEmail;
                return View();
            }

            HttpContext.Session.SetString(RecoveryValidatedSessionKey, "1");
            return RedirectToAction("ResetPassword");
        }

        [HttpGet]
        public IActionResult ResetPassword()
        {
            var validated = HttpContext.Session.GetString(RecoveryValidatedSessionKey);
            var recoveryEmail = HttpContext.Session.GetString(RecoveryEmailSessionKey);

            if (validated != "1" || string.IsNullOrWhiteSpace(recoveryEmail))
            {
                TempData["Error"] = "Debes validar primero el código de recuperación.";
                return RedirectToAction("ForgotPassword");
            }

            ViewBag.RecoveryEmail = recoveryEmail;
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult ResetPassword(string newPassword, string confirmPassword)
        {
            var validated = HttpContext.Session.GetString(RecoveryValidatedSessionKey);
            var recoveryEmail = HttpContext.Session.GetString(RecoveryEmailSessionKey);

            if (validated != "1" || string.IsNullOrWhiteSpace(recoveryEmail))
            {
                TempData["Error"] = "La sesión de recuperación expiró.";
                return RedirectToAction("ForgotPassword");
            }

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            {
                ViewBag.Error = "La nueva contraseña debe tener al menos 6 caracteres.";
                ViewBag.RecoveryEmail = recoveryEmail;
                return View();
            }

            if (newPassword != confirmPassword)
            {
                ViewBag.Error = "La confirmación no coincide con la contraseña.";
                ViewBag.RecoveryEmail = recoveryEmail;
                return View();
            }

            var user = _context.usuarios
                .FirstOrDefault(u => u.correo != null && u.correo.Trim().ToLower() == recoveryEmail && u.estado == true);

            if (user == null)
            {
                TempData["Error"] = "No se encontró el usuario para restablecer la contraseña.";
                return RedirectToAction("ForgotPassword");
            }

            user.contraseña = newPassword;
            _context.SaveChanges();

            LimpiarSesionRecuperacion();

            TempData["Mensaje"] = "Contraseña restablecida correctamente. Inicia sesión.";
            return RedirectToAction("Login");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ReenviarCodigo()
        {
            var recoveryEmail = HttpContext.Session.GetString(RecoveryEmailSessionKey);
            if (string.IsNullOrWhiteSpace(recoveryEmail))
            {
                return BadRequest(new { ok = false, message = "No hay una solicitud activa de recuperación." });
            }

            var recoveryCode = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
            var expirationUtc = DateTime.UtcNow.AddMinutes(5);

            HttpContext.Session.SetString(RecoveryCodeSessionKey, recoveryCode);
            HttpContext.Session.SetString(RecoveryExpirationSessionKey, expirationUtc.ToString("O"));

            try
            {
                var user = await _context.usuarios
                    .FirstOrDefaultAsync(u => u.correo != null && u.correo.Trim().ToLower() == recoveryEmail && u.estado == true);

                if (user != null)
                {
                    await EnviarCodigoRecuperacionAsync(recoveryEmail, recoveryCode, expirationUtc);
                }

                return Ok(new { ok = true, message = "Código reenviado correctamente." });
            }
            catch (Exception)
            {
                return StatusCode(500, new { ok = false, message = "No fue posible reenviar el código." });
            }
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        [HttpPost]
        public IActionResult SingUp(usuarios nuevoUsuario)
        {
            bool existeDni = _context.usuarios.Any(u => u.dni == nuevoUsuario.dni && u.estado == true);
            bool existeCorreo = _context.usuarios.Any(u => u.correo.Trim().ToLower() == nuevoUsuario.correo.Trim().ToLower() && u.estado == true);

            if (existeDni || existeCorreo)
            {
                if (existeDni)
                    ViewBag.ErrorDni = $"El documento de identidad {nuevoUsuario.dni} ya está registrado.";
                if (existeCorreo)
                    ViewBag.ErrorCorreo = $"El correo electrónico {nuevoUsuario.correo} ya está en uso.";
                return View(nuevoUsuario);
            }

            nuevoUsuario.estado = true;
            _context.usuarios.Add(nuevoUsuario);
            _context.SaveChanges();

            return RedirectToAction("Login", "Auth");
        }

        [HttpPost]
        public IActionResult Login(string dni, [FromForm(Name = "contraseña")] string contrasena)
        {
            var user = _context.usuarios
                .FirstOrDefault(u => u.dni == dni && u.contraseña == contrasena);

            if (user != null)
            {
                if (!user.estado)
                {
                    ViewBag.Error = "Usuario Inacivo";
                    return View();
                }

                HttpContext.Session.SetInt32("id", user.id_usuario);
                HttpContext.Session.SetString("dni", user.dni);
                HttpContext.Session.SetString("nombre", user.nombres);
                HttpContext.Session.SetString("apellido", user.apellidos);
                HttpContext.Session.SetInt32("id_rol", user.id_rol);
                HttpContext.Session.SetString("correo", user.correo);
                
                // Guardar la imagen de usuario en la sesión si existe
                if (!string.IsNullOrEmpty(user.imagen_usuario))
                {
                    HttpContext.Session.SetString("imagen_usuario_url", user.imagen_usuario);
                }

                return RedirectToAction("Index", "Home");
            }

            ViewBag.Error = "Usuario o contraseña incorrectos";
            return View();
        }

        public IActionResult CerrarSesion()
        {
            HttpContext.Session.Clear();
            return RedirectToAction("Login");
        }

        private async Task EnviarCodigoRecuperacionAsync(string toEmail, string code, DateTime expirationUtc)
        {
            var smtpHost = _configuration["EmailSettings:SmtpHost"];
            var smtpPortRaw = _configuration["EmailSettings:SmtpPort"];
            var smtpUser = _configuration["EmailSettings:SmtpUser"];
            var smtpPassword = _configuration["EmailSettings:SmtpPassword"];
            var fromEmail = _configuration["EmailSettings:FromEmail"];
            var fromName = _configuration["EmailSettings:FromName"] ?? "Cars Parking Service";
            var enableSslRaw = _configuration["EmailSettings:EnableSsl"];

            if (string.IsNullOrWhiteSpace(smtpHost) ||
                string.IsNullOrWhiteSpace(smtpPortRaw) ||
                string.IsNullOrWhiteSpace(smtpUser) ||
                string.IsNullOrWhiteSpace(smtpPassword) ||
                string.IsNullOrWhiteSpace(fromEmail))
            {
                throw new InvalidOperationException("Configuración de correo incompleta.");
            }

            if (!int.TryParse(smtpPortRaw, out var smtpPort))
            {
                throw new InvalidOperationException("Puerto SMTP inválido.");
            }

            bool enableSsl = true;
            if (!string.IsNullOrWhiteSpace(enableSslRaw))
            {
                bool.TryParse(enableSslRaw, out enableSsl);
            }

            var expirationLocal = expirationUtc.ToLocalTime().ToString("HH:mm");

            using var message = new MailMessage();
            message.From = new MailAddress(fromEmail, fromName);
            message.To.Add(toEmail);
            message.Subject = "Código de recuperación - Cars Parking Service";
            message.IsBodyHtml = true;
            message.Body = $@"
                <div style='font-family: Arial, sans-serif; color: #333;'>
                    <h2 style='color: #b71c1c;'>Recuperación de contraseña</h2>
                    <p>Tu código de verificación es:</p>
                    <p style='font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #b71c1c;'>{code}</p>
                    <p>Este código expira a las <strong>{expirationLocal}</strong>.</p>
                    <p>Si no solicitaste este proceso, puedes ignorar este correo.</p>
                </div>";

            using var smtpClient = new SmtpClient(smtpHost, smtpPort)
            {
                EnableSsl = enableSsl,
                Credentials = new NetworkCredential(smtpUser, smtpPassword)
            };

            await smtpClient.SendMailAsync(message);
        }

        private void LimpiarSesionRecuperacion()
        {
            HttpContext.Session.Remove(RecoveryEmailSessionKey);
            HttpContext.Session.Remove(RecoveryCodeSessionKey);
            HttpContext.Session.Remove(RecoveryExpirationSessionKey);
            HttpContext.Session.Remove(RecoveryValidatedSessionKey);
        }
    }
}