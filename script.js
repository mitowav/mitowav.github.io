let currentBg = 1;

/* ================= NAV ================= */

function go(id){

    document.querySelectorAll("section").forEach(sec=>{
        sec.classList.remove("active");
    });

    const el = document.getElementById(id);
    if(el) el.classList.add("active");

    // fondos
    if(id === "home") cambiarFondo("adri.jpg");
    if(id === "music") cambiarFondo("fondo2.png");
    if(id === "about") cambiarFondo("adri.jpg");
    if(id === "secret") cambiarFondo("fondo2.png");
}

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

/* ================= BACKGROUND FADE ================= */

function cambiarFondo(img){

    const bg1 = document.getElementById("bg1");
    const bg2 = document.getElementById("bg2");

    if(!bg1 || !bg2) return;

    if(currentBg === 1){
        bg2.style.backgroundImage = `url(${img})`;
        bg2.style.opacity = "1";
        bg1.style.opacity = "0";
        currentBg = 2;
    } else {
        bg1.style.backgroundImage = `url(${img})`;
        bg1.style.opacity = "1";
        bg2.style.opacity = "0";
        currentBg = 1;
    }
}

/* ================= SCROLL ANIMATION ================= */

const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
        if(entry.isIntersecting){
            entry.target.classList.add("show");
        }
    });
},{threshold:0.2});

document.querySelectorAll("section").forEach(sec=>{
    observer.observe(sec);
});
