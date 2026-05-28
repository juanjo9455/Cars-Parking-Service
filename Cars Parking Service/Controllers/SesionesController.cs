using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CarsParkingService.Controllers
{
    public class SesionesController : Controller
    {
        // GET: SesionesController
        public ActionResult Index()
        {
            return View();
        }

        // GET: SesionesController/Details/5
        public ActionResult Details(int id)
        {
            return View();
        }

        // GET: SesionesController/Create
        public ActionResult Create()
        {
            return View();
        }

        // POST: SesionesController/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Create(IFormCollection collection)
        {
            try
            {
                return RedirectToAction(nameof(Index));
            }
            catch
            {
                return View();
            }
        }

        // GET: SesionesController/Edit/5
        public ActionResult Edit(int id)
        {
            return View();
        }

        // POST: SesionesController/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Edit(int id, IFormCollection collection)
        {
            try
            {
                return RedirectToAction(nameof(Index));
            }
            catch
            {
                return View();
            }
        }

        // GET: SesionesController/Delete/5
        public ActionResult Delete(int id)
        {
            return View();
        }

        // POST: SesionesController/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Delete(int id, IFormCollection collection)
        {
            try
            {
                return RedirectToAction(nameof(Index));
            }
            catch
            {
                return View();
            }
        }
    }
}
