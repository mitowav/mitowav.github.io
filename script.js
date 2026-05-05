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

/* 🔑 CLAVE SIMPLE */
function comprobarClave(){
    const clave = document.getElementById("clave-input").value;

    if(clave === "1234"){
        cerrarLogin();
        go("secret");
    } else {
        document.getElementById("error-msg").textContent = "Clave incorrecta";
    }
}

/* BEATS */
document.getElementById("subirBeat")?.addEventListener("change", e=>{
    const file = e.target.files[0];
    if(!file) return;

    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "beat-item";

    div.innerHTML = `
        <p>🎵 ${file.name}</p>
        <audio controls src="${url}"></audio>
    `;

    document.getElementById("listaBeat").appendChild(div);
});
