const urlsByCentre = {
    Richcraft: "https://reservation.frontdesksuite.ca/rcfs/richcraftkanata",
    Cardelrec: "https://reservation.frontdesksuite.ca/rcfs/cardelrec",
    Hintonburg: "https://reservation.frontdesksuite.ca/rcfs/hintonburgcc",
    Minto: "https://reservation.frontdesksuite.ca/rcfs/mintobarrhaven",
    Nepean: "https://reservation.frontdesksuite.ca/rcfs/nepeansportsplex",
};

async function populateAvailabilities() {
    const res = await fetch("https://sizjdrimqh.execute-api.us-east-1.amazonaws.com/");
    const availabilitiesByCentre = await res.json();

    const tableBody = document.getElementById("availabilities-body");
    tableBody.innerHTML = "";
    Object.entries(availabilitiesByCentre).forEach(([centre, availabilities]) => {
        const tr = document.createElement("tr");

        const centreCell = document.createElement("td");
        const centreCellLink = document.createElement("a");
        centreCellLink.href = urlsByCentre[centre];
        centreCellLink.innerText = centre;
        centreCell.appendChild(centreCellLink);
        tr.appendChild(centreCell);

        const availabilityCell = document.createElement("td");
        availabilityCell.innerText = availabilities.join("\n");
        tr.appendChild(availabilityCell);

        tableBody.appendChild(tr);
    });
}
