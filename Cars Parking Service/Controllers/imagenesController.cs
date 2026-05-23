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
    public class imagenesController : Controller
    {
        private readonly ApplicationDbContext _context;

        public imagenesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: imagenes
        public async Task<IActionResult> Index()
        {
            var applicationDbContext = _context.imagenes.Include(i => i.ingreso);
            return View(await applicationDbContext.ToListAsync());
        }

        // GET: imagenes/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imagenes = await _context.imagenes
                .Include(i => i.ingreso)
                .FirstOrDefaultAsync(m => m.id_imagen == id);
            if (imagenes == null)
            {
                return NotFound();
            }

            return View(imagenes);
        }

        // GET: imagenes/Create
        public IActionResult Create()
        {
            ViewData["id_ingreso"] = new SelectList(_context.ingresos, "id_ingreso", "id_ingreso");
            return View();
        }

        // POST: imagenes/Create
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("id_imagen,dato_imagen,id_ingreso")] imagenes imagenes)
        {
            if (ModelState.IsValid)
            {
                _context.Add(imagenes);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            ViewData["id_ingreso"] = new SelectList(_context.ingresos, "id_ingreso", "id_ingreso", imagenes.id_ingreso);
            return View(imagenes);
        }

        // GET: imagenes/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imagenes = await _context.imagenes.FindAsync(id);
            if (imagenes == null)
            {
                return NotFound();
            }
            ViewData["id_ingreso"] = new SelectList(_context.ingresos, "id_ingreso", "id_ingreso", imagenes.id_ingreso);
            return View(imagenes);
        }

        // POST: imagenes/Edit/5
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("id_imagen,dato_imagen,id_ingreso")] imagenes imagenes)
        {
            if (id != imagenes.id_imagen)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(imagenes);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!imagenesExists(imagenes.id_imagen))
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
            ViewData["id_ingreso"] = new SelectList(_context.ingresos, "id_ingreso", "id_ingreso", imagenes.id_ingreso);
            return View(imagenes);
        }

        // GET: imagenes/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var imagenes = await _context.imagenes
                .Include(i => i.ingreso)
                .FirstOrDefaultAsync(m => m.id_imagen == id);
            if (imagenes == null)
            {
                return NotFound();
            }

            return View(imagenes);
        }

        // POST: imagenes/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var imagenes = await _context.imagenes.FindAsync(id);
            if (imagenes != null)
            {
                _context.imagenes.Remove(imagenes);
            }

            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool imagenesExists(int id)
        {
            return _context.imagenes.Any(e => e.id_imagen == id);
        }
    }
}
