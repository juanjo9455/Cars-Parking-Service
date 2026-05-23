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
    public class ubicacion_serviciosController : Controller
    {
        private readonly ApplicationDbContext _context;

        public ubicacion_serviciosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: ubicacion_servicios
        public async Task<IActionResult> Index()
        {
            return View(await _context.ubicacion_servicios.ToListAsync());
        }

        // GET: ubicacion_servicios/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ubicacion_servicios = await _context.ubicacion_servicios
                .FirstOrDefaultAsync(m => m.id_ubicacion == id);
            if (ubicacion_servicios == null)
            {
                return NotFound();
            }

            return View(ubicacion_servicios);
        }

        // GET: ubicacion_servicios/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: ubicacion_servicios/Create
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("id_ubicacion,nombre_ubicacion,direccion,ciudad,valor_servicio")] ubicacion_servicios ubicacion_servicios)
        {
            if (ModelState.IsValid)
            {
                _context.Add(ubicacion_servicios);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            return View(ubicacion_servicios);
        }

        // GET: ubicacion_servicios/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ubicacion_servicios = await _context.ubicacion_servicios.FindAsync(id);
            if (ubicacion_servicios == null)
            {
                return NotFound();
            }
            return View(ubicacion_servicios);
        }

        // POST: ubicacion_servicios/Edit/5
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("id_ubicacion,nombre_ubicacion,direccion,ciudad,valor_servicio")] ubicacion_servicios ubicacion_servicios)
        {
            if (id != ubicacion_servicios.id_ubicacion)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(ubicacion_servicios);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ubicacion_serviciosExists(ubicacion_servicios.id_ubicacion))
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
            return View(ubicacion_servicios);
        }

        // GET: ubicacion_servicios/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ubicacion_servicios = await _context.ubicacion_servicios
                .FirstOrDefaultAsync(m => m.id_ubicacion == id);
            if (ubicacion_servicios == null)
            {
                return NotFound();
            }

            return View(ubicacion_servicios);
        }

        // POST: ubicacion_servicios/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var ubicacion_servicios = await _context.ubicacion_servicios.FindAsync(id);
            if (ubicacion_servicios != null)
            {
                _context.ubicacion_servicios.Remove(ubicacion_servicios);
            }

            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool ubicacion_serviciosExists(int id)
        {
            return _context.ubicacion_servicios.Any(e => e.id_ubicacion == id);
        }
    }
}
