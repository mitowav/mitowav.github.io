document.addEventListener("DOMContentLoaded", () => {

    /* ================= NAV ================= */

    function go(id){

        document.querySelectorAll("section").forEach(sec=>{
            sec.classList.remove("active");
        });

        const el = document.getElementById(id);
        if(el) el.classList.add("active");
    }

    window.go = go;

    /* ================= LOGIN ================= */

    function openLogin(){
        document.getElementById("login-overlay").classList.add("visible");
    }

    function cerrarLogin(){
        document.getElementById("login-overlay").classList.remove("visible");
    }

    function comprobarClave(){

        const input = document.getElementById("clave-input");
        const error = document.getElementById("error-msg");

        if(input.value === "1234"){
            cerrarLogin();
            go("secret");
        } else {
            error.textContent = "Clave incorrecta";
        }
    }

    window.openLogin = openLogin;
    window.cerrarLogin = cerrarLogin;
    window.comprobarClave = comprobarClave;

    /* ================= IMPORTANTE =================
       Esto fuerza que SIEMPRE empiece en home
    */

    go("home");
});
