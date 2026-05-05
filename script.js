function go(id){
    document.querySelectorAll(".page").forEach(p=>{
        p.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

/* LOGIN */
function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function cerrarLogin(){
    document.getElementById("login-overlay").classList.remove("visible");
}

/* 🔑 FIX REAL AQUÍ */
function comprobarClave(){
    const input = document.getElementById("clave-input");
    const error = document.getElementById("error-msg");

    if(!input) return;

    const clave = input.value.trim(); // 🔥 IMPORTANTE (quita espacios)

    if(clave === "1234"){
        cerrarLogin();
        go("secret");
        if(error) error.textContent = "";
    } else {
        if(error) error.textContent = "Clave incorrecta";
    }
}
