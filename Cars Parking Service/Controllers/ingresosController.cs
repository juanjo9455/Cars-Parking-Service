using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using Cars_Parking_Service.Data;
using Cars_Parking_Service.Models;

namespace Cars_Parking_Service.Controllers
{
    public class ingresosController : Controller
    {
        private readonly ApplicationDbContext _context;

        public ingresosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: ingresos
        public async Task<IActionResult> Index()
        {
            var applicationDbContext = _context.ingresos.Include(i => i.Banco).Include(i => i.Ubicacion).Include(i => i.Valet);
            return View(await applicationDbContext.ToListAsync());
        }

        // GET: ingresos/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ingresos = await _context.ingresos
                .Include(i => i.Banco)
                .Include(i => i.Ubicacion)
                .Include(i => i.Valet)
                .FirstOrDefaultAsync(m => m.id_ingreso == id);
            if (ingresos == null)
            {
                return NotFound();
            }

            return View(ingresos);
        }

        // GET: ingresos/Create
        public IActionResult Create()
        {
            ViewData["id_banco"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario");
            ViewData["id_ubicacion"] = new SelectList(_context.ubicacion_servicios, "id_ubicacion", "id_ubicacion");
            ViewData["id_valet"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario");
            return View();
        }

        // POST: ingresos/Create
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create([Bind("id_ingreso,placa,fecha_ingreso,fecha_salida,estado_pago,estado_servicio,id_valet,id_banco,id_parqueadero,id_ubicacion,notas,firma,valor_servicio,valor_propina")] ingresos ingresos)
        {
            if (ModelState.IsValid)
            {
                _context.Add(ingresos);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            ViewData["id_banco"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_banco);
            ViewData["id_ubicacion"] = new SelectList(_context.ubicacion_servicios, "id_ubicacion", "id_ubicacion", ingresos.id_ubicacion);
            ViewData["id_valet"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_valet);
            return View(ingresos);
        }

        // GET: ingresos/Edit/5
        public async Task<IActionResult> Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ingresos = await _context.ingresos.FindAsync(id);
            if (ingresos == null)
            {
                return NotFound();
            }
            ViewData["id_banco"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_banco);
            ViewData["id_ubicacion"] = new SelectList(_context.ubicacion_servicios, "id_ubicacion", "id_ubicacion", ingresos.id_ubicacion);
            ViewData["id_valet"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_valet);
            return View(ingresos);
        }

        // POST: ingresos/Edit/5
        // To protect from overposting attacks, enable the specific properties you want to bind to.
        // For more details, see http://go.microsoft.com/fwlink/?LinkId=317598.
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(int id, [Bind("id_ingreso,placa,fecha_ingreso,fecha_salida,estado_pago,estado_servicio,id_valet,id_banco,id_parqueadero,id_ubicacion,notas,firma,valor_servicio,valor_propina")] ingresos ingresos)
        {
            if (id != ingresos.id_ingreso)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(ingresos);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ingresosExists(ingresos.id_ingreso))
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
            ViewData["id_banco"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_banco);
            ViewData["id_ubicacion"] = new SelectList(_context.ubicacion_servicios, "id_ubicacion", "id_ubicacion", ingresos.id_ubicacion);
            ViewData["id_valet"] = new SelectList(_context.usuarios, "id_usuario", "id_usuario", ingresos.id_valet);
            return View(ingresos);
        }

        // GET: ingresos/Delete/5
        public async Task<IActionResult> Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var ingresos = await _context.ingresos
                .Include(i => i.Banco)
                .Include(i => i.Ubicacion)
                .Include(i => i.Valet)
                .FirstOrDefaultAsync(m => m.id_ingreso == id);
            if (ingresos == null)
            {
                return NotFound();
            }

            return View(ingresos);
        }

        // POST: ingresos/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            var ingresos = await _context.ingresos.FindAsync(id);
            if (ingresos != null)
            {
                _context.ingresos.Remove(ingresos);
            }

            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool ingresosExists(int id)
        {
            return _context.ingresos.Any(e => e.id_ingreso == id);
        }
    }
}
