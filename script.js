function go(id){
    document.querySelectorAll("section").forEach(sec=>{
        sec.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function cerrarLogin(){
    document.getElementById("login-overlay").classList.remove("visible");
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
}

function comprobarClave(){
    const clave = document.getElementById("clave-input").value;

    if(clave === "adri123"){
        cerrarLogin();
        go("music");
    } else {
        document.getElementById("error-msg").textContent = "Clave incorrecta";
    }
}
