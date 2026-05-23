using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using CarsParkingService.Data;
using CarsParkingService.Models;

namespace CarsParkingService.Controllers
{
    public class parqueaderosController : Controller
    {
        private readonly ApplicationDbContext _context;

        public parqueaderosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: parqueaderos
        public async Task<IActionResult> Index()
        {
            return View(await _context.parqueaderos.ToListAsync());
        }

        // GET: parqueaderos/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var parqueaderos = await _context.parqueaderos
                .FirstOrDefaultAsync(m => m.id_parqueadero == id);
            if (parqueaderos == null)
            {
                return NotFound();
            }

            return View(parqueaderos);
        }

        // GET: parqueaderos/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: parqueaderos/Create
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("id_parqueadero,direccion,ciudad,nombre_parqueadero,tarifa")] parqueaderos parqueaderos)
        {
            if (ModelState.IsValid)
            {
                _context.Add(parqueaderos);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            return View(parqueaderos);
        }

        // GET: parqueaderos/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var parqueaderos = await _context.parqueaderos.FindAsync(id);
            if (parqueaderos == null)
            {
                return NotFound();
            }
            return View(parqueaderos);
        }

        // POST: parqueaderos/Edit/5
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("id_parqueadero,direccion,ciudad,nombre_parqueadero,tarifa")] parqueaderos parqueaderos)
        {
            if (id != parqueaderos.id_parqueadero)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(parqueaderos);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!parqueaderosExists(parqueaderos.id_parqueadero))
                    {
                        return NotFound();
                    }
                    else
                    {
                        throw;
                    }
                }
                return RedirectToAction(nameof(Index));
            }
            return View(parqueaderos);
        }

        // GET: parqueaderos/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var parqueaderos = await _context.parqueaderos
                .FirstOrDefaultAsync(m => m.id_parqueadero == id);
            if (parqueaderos == null)
            {
                return NotFound();
            }

            return View(parqueaderos);
        }

        // POST: parqueaderos/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var parqueaderos = await _context.parqueaderos.FindAsync(id);
            if (parqueaderos != null)
            {
                _context.parqueaderos.Remove(parqueaderos);
            }

            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool parqueaderosExists(int id)
        {
            return _context.parqueaderos.Any(e => e.id_parqueadero == id);
        }
    }
}
