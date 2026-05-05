function go(id){
    document.querySelectorAll("section").forEach(s=>{
        s.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function comprobarClave(){
    const clave = document.getElementById("clave-input").value;

    if(clave === "adri123"){
        document.getElementById("login-overlay").classList.remove("visible");
        go("music");
        document.getElementById("error-msg").textContent = "";
    } else {
        document.getElementById("error-msg").textContent = "Clave incorrecta";
    }
}

document.getElementById("subirBeat").addEventListener("change", e=>{
    const file = e.target.files[0];
    if(!file) return;

    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "beat-item";

    div.innerHTML = `
        🎵 ${file.name}
        <br>
        <audio controls src="${url}"></audio>
    `;

    document.getElementById("listaBeat").appendChild(div);
});
