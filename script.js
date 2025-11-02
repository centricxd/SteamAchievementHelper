const tbody = document.querySelector("#achievementsTable tbody");
const statusFilter = document.getElementById("statusFilter");
const fetchBtn = document.getElementById("fetchBtn");
const appIdInput = document.getElementById("appIdInput");
const steamIdInput = document.getElementById("steamIdInput");
const nameFilterInput = document.getElementById("nameFilter");
const descFilterInput = document.getElementById("descFilter");
const container = document.getElementById("container");
const progressBar = document.getElementById("progressBar");
const gameChip = document.querySelector(".gameChip");
const tableWrapper = document.getElementById("tableWrapper");

const proxyUrl = "https://corsproxy.io/?url=";
const apiKey = "107D2DAAF5119FADAA376F3CCABC03B7";
const steamID = () => steamIdInput.value.trim() || "76561199105599453";

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
}

let achievementsWithGuides = [];
let sortDirection = {};

function updateProgress() {
    const total = achievementsWithGuides.length;
    const unlocked = achievementsWithGuides.filter(a => a.achieved).length;
    progressBar.style.width = total ? Math.round(unlocked / total * 100) + "%" : "0%";
}

function renderTable() {
    const statusVal = statusFilter.value.toLowerCase();
    const nameVal = nameFilterInput.value.toLowerCase();
    const descVal = descFilterInput.value.toLowerCase();
    tbody.innerHTML = "";

    achievementsWithGuides
        .filter(a => {
            if (statusVal === "locked" && a.achieved) return false;
            if (statusVal === "unlocked" && !a.achieved) return false;
            if (!a.displayName.toLowerCase().includes(nameVal)) return false;
            if (!a.description.toLowerCase().includes(descVal)) return false;
            return true;
        })
        .forEach(a => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><img src="${a.icon}" class="${!a.achieved ? "locked" : ""}" alt="${a.displayName}"></td>
                <td>${a.displayName}</td>
                <td>${a.description}</td>
                <td class="${a.achieved ? "achieved" : "locked"}">${a.achieved ? "Achieved" : "Locked"}</td>
                <td>${a.unlocktime}</td>
                <td>
                    <a href="${a.guide}" target="_blank">Guide</a>
                    <button class="copyBtn" data-link="${a.guide}">Copy</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    updateProgress();
    document.querySelectorAll(".copyBtn").forEach(btn => {
        btn.onclick = () => navigator.clipboard.writeText(btn.dataset.link);
    });
}

statusFilter.addEventListener("change", renderTable);
nameFilterInput.addEventListener("input", renderTable);
descFilterInput.addEventListener("input", renderTable);

document.querySelectorAll("#achievementsTable th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
        const key = th.dataset.sort;
        const direction = sortDirection[key] === "asc" ? "desc" : "asc";
        sortDirection[key] = direction;

        achievementsWithGuides.sort((a, b) => {
            if (key === "name") return direction === "asc" ? a.displayName.localeCompare(b.displayName) : b.displayName.localeCompare(a.displayName);
            if (key === "description") return direction === "asc" ? a.description.localeCompare(b.description) : b.description.localeCompare(a.description);
            if (key === "status") return direction === "asc" ? a.achieved - b.achieved : b.achieved - a.achieved;
            if (key === "time") return direction === "asc" ? new Date(a.unlocktime) - new Date(b.unlocktime) : new Date(b.unlocktime) - new Date(a.unlocktime);
            return 0;
        });

        renderTable();
    });
});

async function fetchAchievements(appId) {
    try {
        // --- Player achievements ---
        const resStats = await fetch(`${proxyUrl}https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appId}&steamid=${steamID()}&key=${apiKey}`);
        const statsData = await resStats.json();
        if (!statsData.playerstats?.achievements) throw new Error("No achievements found");

        // ---       Achievement schema ---
        const resDefs = await fetch(`${proxyUrl}https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?appid=${appId}&key=${apiKey}`);
        const defsData = await resDefs.json();
        if (!defsData.game?.availableGameStats?.achievements) throw new Error("No achievement definitions found");

        const playerAchievements = statsData.playerstats.achievements;
        const achievementDefs = defsData.game.availableGameStats.achievements;

        // --- Game details (fallback-safe) ---
        let storeData = {};
        try {
            const resExtra = await fetch(`${proxyUrl}https://store.steampowered.com/api/appdetails?appids=${appId}`);
            const data = await resExtra.json();
            storeData = data[appId]?.data || {};
        } catch (e) {
            console.warn("App details failed, continuing without store data.");
        }

        // // --- Map achievements ---
        // const guideLink = `https://steamcommunity.com/app/${appId}/guides/?searchText=&browsefilter=trend&browsesort=creationorder&requiredtags%5B%5D=Achievements&requiredtags%5B%5D=English`;

        achievementsWithGuides = playerAchievements.map(playerAch => {
            const def = achievementDefs.find(d => d.name === playerAch.apiname);
            if (!def) return null;
            return {
                displayName: def.displayName,
                description: def.description || "No description",
                icon: def.icon || "",
                achieved: !!playerAch.achieved,
                unlocktime: playerAch.unlocktime ? new Date(playerAch.unlocktime * 1000).toLocaleString() : "Locked",
                guide: `https://steamcommunity.com/app/${appId}/guides/?searchText=${def.displayName}+Achievement&browsefilter=trend&browsesort=creationorder&requiredtags%5B%5D=Achievements&requiredtags%5B%5D=English`
            };
        }).filter(Boolean);

        // ---  Fill game chip ---
        if (gameChip) {
            const img = gameChip.querySelector("img");
            const title = gameChip.querySelector(".chipDetails h3");
            const desc = gameChip.querySelector(".chipDesc");
            const progressBarEl = gameChip.querySelector(".progressBar");
            const progressText = gameChip.querySelector(".progressText");
            const chipTags = gameChip.querySelector(".chipTags");

            if (img) img.src = storeData.header_image || defsData.game?.gameIcon || img.src;
            if (title) title.textContent = statsData.playerstats.gameName || storeData.name || "Unknown Game";
            if (desc) desc.textContent = storeData.short_description || "No description available";

            const total = achievementsWithGuides.length;
            const unlocked = achievementsWithGuides.filter(a => a.achieved).length;
            const percent = total ? Math.round((unlocked / total) * 100) : 0;

            if (progressBarEl) progressBarEl.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `${unlocked}/${total} (${percent}%)`;

            if (chipTags) {
                chipTags.innerHTML = "";
                if (storeData.genres) {
                    storeData.genres.forEach(g => {
                        const span = document.createElement("span");
                        span.className = "tag genre";
                        span.textContent = g.description;
                        chipTags.appendChild(span);
                    });
                }

                const guideTag = document.createElement("a");
                guideTag.href = `https://steamcommunity.com/app/${appId}/guides/?searchText=Achievement+Guide&browsefilter=trend&browsesort=creationorder&requiredtags%5B%5D=Achievements&requiredtags%5B%5D=English`;
                guideTag.target = "_blank";
                guideTag.className = "tag guide";
                guideTag.textContent = "Guides";
                chipTags.appendChild(guideTag);
            }

            gameChip.classList.remove("hidden");
        }

        if (tableWrapper) tableWrapper.classList.remove("hidden");
        renderTable();
        if (container) container.classList.add("ready");

    } catch (err) {
        alert(`Error fetching achievements: ${err.message}`);
        console.error(err);
    }
}

fetchBtn.addEventListener("click", () => {
    const appId = appIdInput.value.trim();
    if (!appId) return alert("Enter a valid AppID");
    fetchAchievements(appId);
});
