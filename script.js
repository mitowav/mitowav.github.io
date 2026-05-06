function go(id){
    document.querySelectorAll("section").forEach(sec=>{
        sec.classList.remove("active");
    });

    const el = document.getElementById(id);
    if(el) el.classList.add("active");
}

/* LOGIN */
function openLogin(){
    document.getElementById("login-overlay").style.opacity = "1";
    document.getElementById("login-overlay").style.pointerEvents = "all";
}

function cerrarLogin(){
    document.getElementById("login-overlay").style.opacity = "0";
    document.getElementById("login-overlay").style.pointerEvents = "none";
}

/* CLAVE SIMPLE */
function comprobarClave(){
    const input = document.getElementById("clave-input");
    const error = document.getElementById("error-msg");

    if(!input) return;

    if(input.value === "1234"){
        cerrarLogin();
        go("secret");
    } else {
        error.textContent = "Clave incorrecta";
    }
}
