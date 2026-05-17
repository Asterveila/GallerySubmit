fetch('../assets/iconkit-data.json').then(r => r.json()).then(loadRobotAnimations).catch(() => {
    console.warn('assets/iconkit-data.json not found — robot/spider poses will use approximations');
});

let currentIconPayload = null;
let portalRenderer = null;

document.addEventListener('DOMContentLoaded', () => {
    setupUploadZone();
    document.getElementById('btnFinalSubmit').addEventListener('click', submitToServer);
    document.getElementById('btnCloseFeedback').addEventListener('click', () => {
        document.getElementById('feedbackPopup').classList.remove('active');
    });

    document.getElementById('btnChangeIcon').addEventListener('click', () => {
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('gdiconDropZone').style.display = 'block';
        document.getElementById('gdiconDropLabel').innerHTML = `<span class="font-pusab" style="font-size: 1.2rem; -webkit-text-stroke: 1px black;">Upload .gdicon file</span>`;
        currentIconPayload = null;
    });
});

function setupUploadZone() {
    const zone = document.getElementById('gdiconDropZone');
    const input = document.getElementById('gdiconUpload');

    zone.addEventListener('click', () => input.click());
    
    input.addEventListener('change', e => {
        if (e.target.files.length > 0) processGdicon(e.target.files[0]);
    });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith('.gdicon'));
        if (file) processGdicon(file);
    });
}

async function processGdicon(file) {
    document.getElementById('gdiconDropLabel').innerHTML = `<span class="font-pusab">Loading ${escapeHtml(file.name)}...</span>`;
    
    try {
        const zip = await JSZip.loadAsync(file);
        
        const jsonFile = zip.file(/^icon\.json$/i)[0];
        if (!jsonFile) throw new Error('Missing icon.json');
        const meta = JSON.parse(await jsonFile.async('string'));

        // BAN CHECK
        const isBanned = await checkBanStatus(meta.uuid);
        if (isBanned) {
            showFeedback("Uh oh!", `You have been banned from submitting icons.\nReason: ${isBanned}`, true);
            document.getElementById('gdiconDropLabel').innerHTML = `<span class="font-pusab">Upload Blocked</span>`;
            return;
        }

        const pngEntry = zip.file(/\.png$/i)[0];
        const plistEntry = zip.file(/\.plist$/i)[0];
        if (!pngEntry || !plistEntry) throw new Error('Missing PNG or PLIST');

        const pngBlob = new File([await pngEntry.async('blob')], pngEntry.name, { type: 'image/png' });
        const plistBlob = new File([await plistEntry.async('blob')], plistEntry.name, { type: 'text/xml' });

        // store
        currentIconPayload = { file, meta };

        document.getElementById('gdiconDropZone').style.display = 'none';
        document.getElementById('previewSection').style.display = 'flex';
        updateLabels(meta);
        
        // renderererererer
        if (!portalRenderer) portalRenderer = new GdIconRenderer(document.getElementById('portalCanvas'), 200);
        await portalRenderer.renderIcon(pngBlob, plistBlob, meta, { glow: true });

    } catch (err) {
        showFeedback("Failed...", "Could not read .gdicon file: " + err.message);
        document.getElementById('gdiconDropLabel').innerHTML = `<span class="font-pusab">Upload .gdicon file</span>`;
    }
}

async function checkBanStatus(uuid) {
    if (!uuid) return null;
    try {
        const res = await fetch('https://jester-overhear-unsavory.ngrok-free.dev/api/banned-users', {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return null;
        const banList = await res.json();
        return banList[uuid] || null;
    } catch (e) {
        console.warn("Could not check ban list", e);
        return null;
    }
}

function updateLabels(meta) {
    document.getElementById('p-name').textContent = meta.iconName;
    
    let authorStr = escapeHtml(meta.author);
    if (meta.isCollab && meta.collabWith) authorStr += ` & ${escapeHtml(meta.collabWith.join(', '))}`;
    document.getElementById('p-author').innerHTML = `by <span class="font-golden">${authorStr}</span>`;
    
    document.getElementById('p-desc').textContent = meta.description || 'No description';
    
    const typeEl = document.getElementById('p-type');
    typeEl.textContent = meta.iconType;
    typeEl.className = `tag tag-${meta.iconType.toLowerCase()}`;
    
    const formatEl = document.getElementById('p-format');
    formatEl.textContent = meta.format;
    formatEl.className = `tag tag-${meta.format.toLowerCase()}`;

    const c = meta.colors[0];
    document.getElementById('pc-1').style.background = c.p1;
    document.getElementById('pc-2').style.background = c.p2;
    document.getElementById('pc-g').style.background = c.glow;
}

async function submitToServer() {
    if (!currentIconPayload) return;

    const btn = document.getElementById('btnFinalSubmit');
    const spinner = document.getElementById('loadingSpinner');

    btn.style.display = 'none';
    spinner.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append("iconData", currentIconPayload.file);
        
        const response = await fetch("https://jester-overhear-unsavory.ngrok-free.dev/api/submit", { 
            method: "POST", 
            body: formData 
        });

        if (!response.ok) throw new Error(await response.text());

        showFeedback("Success!", "Your icon has been added to the queue for review! \n\nPlease be patient for your icon to be reviewed. You won't see your icon on the gallery IMMEDIATELY, as every icon has to be reviewed and accepted by the Gallery Moderation team. \n\nWe recommend you join our discord so you can see which icons were accepted and which were denied!");
        
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('gdiconDropZone').style.display = 'block';
        document.getElementById('gdiconDropLabel').innerHTML = `<span class="font-pusab">Upload .gdicon file</span>`;
        currentIconPayload = null;

    } catch (err) {
        showFeedback("Failed...", "Server error: " + err.message);
    } finally {
        btn.style.display = 'block';
        spinner.style.display = 'none';
    }
}

function showFeedback(title, message, isBan = false) {
    document.getElementById('fbTitle').textContent = title;
    document.getElementById('fbTitle').style.color = isBan ? '#ff6b6b' : '#ffffff';
    document.getElementById('fbMessage').innerText = message;
    document.getElementById('feedbackPopup').classList.add('active');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}