using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using CarsParkingService.Models;
using Microsoft.AspNetCore.Mvc;
using CarsParkingService.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.JSInterop.Infrastructure;
using AspNetCoreGeneratedDocument;

namespace CarsParkingService.Controllers
{
    public class PoliticasController : Controller
    {
        private const string RecoveryEmailSessionKey = "RecoveryEmail";
        private const string RecoveryCodeSessionKey = "RecoveryCode";
        private const string RecoveryExpirationSessionKey = "RecoveryCodeExpirationUtc";
        private const string RecoveryValidatedSessionKey = "RecoveryValidated";

        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public PoliticasController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public IActionResult Politicas()
        {
            return View();

        }
    }
}