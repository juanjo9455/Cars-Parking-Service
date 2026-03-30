using System.Diagnostics;
using Cars_Parking_Service.Models;
using Microsoft.AspNetCore.Mvc;

namespace Cars_Parking_Service.Controllers
{
    public class PaymentController : Controller
    {
        public IActionResult Pago()
        {
            return View();
        }

        public IActionResult Estado_Servicio()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
