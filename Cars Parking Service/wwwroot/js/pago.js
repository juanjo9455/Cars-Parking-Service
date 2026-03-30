document.addEventListener("DOMContentLoaded", function () {
    const btn_solicitar = document.getElementById("btn-solicitar");
    const modal_pagar = document.getElementById("modal-pagar");
    const btn_pagar = document.getElementById("btn-pagar");
    const info_1 = document.getElementById("informacion_1");
    const info_2 = document.getElementById("informacion_2");
    //const modal_confirmacion = document.getElementById("modal_confirmacion");

    modal_pagar.classList.add("oculto");
    //modal_confirmacion.style.display = "none";

    btn_solicitar.addEventListener("click", function () {
        modal_pagar.classList.remove("oculto");
    });

    btn_pagar.addEventListener("click", function () {
        info_1.style.display = "none";
        info_2.style.display = "flex";
        
    });
});

// ========= Pagar Servicio ======== //

function seleccionar(btn) {
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
}

// Cuenta regresiva
/*/let segundos = 8 * 60;
const el = document.getElementById('minutos');
setInterval(() => {
    if (segundos > 0) {
        segundos--;
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        el.textContent = m > 0 ? m : `0:${s.toString().padStart(2, '0')}`;
    }
}, 1000);*/

/*function pagar() {
    const btn = document.querySelector('.btn-pagar');
    btn.textContent = '✅ Pago confirmado';
    btn.style.background = 'linear-gradient(135deg, #27ae60, #1e8449)';
    btn.disabled = true;
}*/
