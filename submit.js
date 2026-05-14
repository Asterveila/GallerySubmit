fetch('assets/iconkit-data.json').then(r => r.json()).then(loadRobotAnimations).catch(() => {
    console.warn('assets/iconkit-data.json not found — robot/spider poses will use approximations');
});

let uploadedPng = null;
let uploadedPlist = null;
let uploadedProjectFiles = [];
let previewRenderer = null;

document.addEventListener('DOMContentLoaded', () => {
    setupFileDropZones();
    setupColorPickers();
    setupCollabToggle();
    setupPreviewGlow();
    setupLivePreviewUpdates();
    document.getElementById('generateBtn').addEventListener('click', generateGdicon);

    document.getElementById('guidelinesContent').innerHTML = parseMarkdown(guidelinesText);
    
    document.getElementById('btnGuidelines').addEventListener('click', () => {
        document.getElementById('guidelinesPopup').classList.add('active');
    });
    
    document.getElementById('btnCloseGuidelines').addEventListener('click', () => {
        document.getElementById('guidelinesPopup').classList.remove('active');
    });
});

function setupFileDropZones() {
    setupDropZone('pngDropZone', 'pngUpload', '.png', false, files => {
        uploadedPng = files[0];
        document.getElementById('pngDropLabel').innerHTML =
            `<span class="drop-icon">✅</span><span><strong>${escapeHtml(files[0].name)}</strong> ready</span>`;
        tryPreview();
    });

    setupDropZone('plistDropZone', 'plistUpload', '.plist', false, files => {
        uploadedPlist = files[0];
        document.getElementById('plistDropLabel').innerHTML =
            `<span class="drop-icon">✅</span><span><strong>${escapeHtml(files[0].name)}</strong> ready</span>`;
        tryPreview();
    });

    setupDropZone('projectDropZone', 'projectUpload', '', true, files => {
        if (!files || files.length === 0) return;
        uploadedProjectFiles = files;
        document.getElementById('projectDropLabel').innerHTML =
            `<span class="drop-icon">✅</span><span><strong>${files.length} file(s)</strong> attached</span>`;
    });
}

function setupDropZone(zoneId, inputId, acceptExt, allowMultiple, onFiles) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    zone.addEventListener('click', () => input.click());
    
    input.addEventListener('change', e => {
        if (e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
        }
    });

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        
        let files = Array.from(e.dataTransfer.files);
        
        if (acceptExt) {
            files = files.filter(f => f.name.toLowerCase().endsWith(acceptExt));
        }
        
        if (files.length > 0) {
            if (!allowMultiple) files = [files[0]];
            onFiles(files);
        }
    });
}

function setupColorPickers() {
    const pairs = [
        ['col1Input', 'col1Hex', 'swatchP1'],
        ['col2Input', 'col2Hex', 'swatchP2'],
        ['glowInput', 'glowHex', 'swatchGlow']
    ];

    for (const [pickerId, hexId, swatchId] of pairs) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexId);
        const swatch = document.getElementById(swatchId);

        picker.addEventListener('input', () => {
            hex.value = picker.value.toUpperCase();
            swatch.style.background = picker.value;
            tryPreview();
        });

        hex.addEventListener('input', () => {
            if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
                picker.value = hex.value;
                swatch.style.background = hex.value;
                tryPreview();
            }
        });
    }
}

function setupCollabToggle() {
    document.getElementById('isCollabCheck').addEventListener('change', e => {
        document.getElementById('collabInputs').style.display = e.target.checked ? 'block' : 'none';
    });
}

function setupPreviewGlow() {
    document.getElementById('previewGlow').addEventListener('change', tryPreview);
}

function setupLivePreviewUpdates() {
    ['iconNameInput', 'authorInput'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreviewLabels);
    });

    document.getElementById('iconTypeSelect').addEventListener('change', tryPreview);
}

function handleProjectFiles(files) {
    if (!files || files.length === 0) return;
    uploadedProjectFiles = Array.from(files);
    document.getElementById('projectDropLabel').innerHTML =
        `<span class="drop-icon">✅</span><span><strong>${uploadedProjectFiles.length} file(s)</strong> attached</span>`;
}

document.getElementById('hasProjectFilesCheck').addEventListener('change', e => {
    const container = document.getElementById('projectDropZoneContainer');
    if (e.target.checked) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        uploadedProjectFiles = [];
        document.getElementById('projectDropLabel').innerHTML = `<span>Drop your project files here, or click to browse</span>`;
        projInput.value = ''; 
    }
});

async function tryPreview() {
    if (!uploadedPng || !uploadedPlist) return;

    const canvas = document.getElementById('previewCanvas');
    const placeholder = document.getElementById('previewPlaceholder');

    const iconType = document.getElementById('iconTypeSelect').value || 'Cube';
    const format = document.getElementById('formatSelect').value || 'vanilla';

    const meta = buildMetaFromForm();
    const glow = document.getElementById('previewGlow').checked;

    placeholder.style.display = 'none';
    canvas.style.display = 'block';

    if (!previewRenderer) {
        previewRenderer = new GdIconRenderer(canvas, 240);
    }

    try {
        await previewRenderer.renderIcon(uploadedPng, uploadedPlist, meta, {
            glow,
            col1: document.getElementById('col1Input').value,
            col2: document.getElementById('col2Input').value,
            glowCol: document.getElementById('glowInput').value
        });
    } catch (err) {
        console.warn('Preview render error:', err);
        placeholder.style.display = 'flex';
        placeholder.textContent = 'Preview failed — check your files';
        canvas.style.display = 'none';
    }

    document.getElementById('previewLabelArea').style.display = 'block';
    updatePreviewLabels();
}

function updatePreviewLabels() {
    const name = document.getElementById('iconNameInput').value || '—';
    const author = document.getElementById('authorInput').value || '—';
    document.getElementById('previewIconName').textContent = name;
    document.getElementById('previewIconAuthor').textContent = 'by ' + author;
}

function buildMetaFromForm() {
    const isCollab = document.getElementById('isCollabCheck').checked;
    const collabRaw = document.getElementById('collabWith').value;
    const collabWith = isCollab
        ? collabRaw.split('\n').map(s => s.trim()).filter(Boolean)
        : [];

    return {
        iconName: document.getElementById('iconNameInput').value.trim(),
        iconType: document.getElementById('iconTypeSelect').value,
        author: document.getElementById('authorInput').value.trim(),
        isCollab,
        collabWith,
        description: document.getElementById('descInput').value.trim(),
        format: document.getElementById('formatSelect').value,
        creationDate: new Date().toISOString(),
        uuid: generateDeviceUUID(),
        hasProjectFiles: document.getElementById('hasProjectFilesCheck').checked && uploadedProjectFiles.length > 0,
        colors: [{
            p1: document.getElementById('col1Input').value,
            p2: document.getElementById('col2Input').value,
            glow: document.getElementById('glowInput').value
        }]
    };
}

function validate(meta) {
    const errors = [];
    if (!uploadedPng) errors.push('PNG spritesheet is required.');
    if (!uploadedPlist) errors.push('PLIST file is required.');
    if (!meta.iconName) errors.push('Icon name is required.');
    if (!meta.iconType) errors.push('Icon type is required.');
    if (!meta.author) errors.push('Author name is required.');
    if (!meta.format) errors.push('Format is required.');
    return errors;
}

function generateDeviceUUID() {
    const str = `${Intl.DateTimeFormat().resolvedOptions().timeZone}|${navigator.language}|${navigator.userAgent}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return Math.abs(hash).toString(16) + str.length.toString(16);
}

async function generateGdicon() {
    const meta = buildMetaFromForm();
    const errors = validate(meta);

    const errBox = document.getElementById('validationErrors');
    if (errors.length) {
        errBox.style.display = 'block';
        errBox.innerHTML = errors.map(e => `<p class="error-item">⚠ ${escapeHtml(e)}</p>`).join('');
        return;
    }
    errBox.style.display = 'none';

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const zip = new JSZip();
        const baseName = uploadedPng.name.replace(/-uhd\.png$/, '').replace(/\.png$/, '');

        zip.file(uploadedPng.name, uploadedPng);
        zip.file(uploadedPlist.name, uploadedPlist);
        zip.file('icon.json', JSON.stringify(meta, null, 2));

        const canvas = document.getElementById('previewCanvas');
        if (canvas && canvas.style.display !== 'none') {
            const previewBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            zip.file('preview.png', previewBlob);
        }

        if (meta.hasProjectFiles && uploadedProjectFiles.length > 0) {
            const projZip = new JSZip();
            uploadedProjectFiles.forEach(f => projZip.file(f.name, f));
            const projBlob = await projZip.generateAsync({ type: 'blob' });
            zip.file('projectFiles.zip', projBlob);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const filename = sanitizeFilename(meta.iconName) + '.gdicon';

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        btn.textContent = '✓ Downloaded!';
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Generate .gdicon';
        }, 2500);

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Generate .gdicon';
        errBox.style.display = 'block';
        errBox.innerHTML = `<p class="error-item">⚠ Generation failed: ${escapeHtml(err.message)}</p>`;
    }
}

function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 64) || 'icon';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const guidelinesText = `
# Guidelines [ENG]
Icon Gallery is a pretty simple project, so the guidelines are pretty simple too.
Failure to follow any of these guidelines will result in your icons getting rejected.
Ignoring these rules multiple times will get you banned from submitting icons entirely.

## - No NSFW
Submitted icons can NOT contain **ANY KIND** of NSFW imagery. Including but not limited to:
- Adult imagery (Suggestive stuff will be considered depending on how strong, but is likely to be rejected.)
- Rude speech (Extreme swearing on Icon Names, descriptions, or even icons themselves)
- Hate speech (ANY kind of hate towards any group of people, Homophobia, Transphobia, Racism, either spoken or via imagery.)

## - No stolen Icons
By submitting an icon you agree and admit that you either:
- OWN the icon ENTIRELY (You made it yourself or collabed on it and got permission)
- Got permission from the original author to submit the icon.
If you're submitting a public, well known icon under the original Artists' name, this is most likely okay, as it helps Icon Gallery's goal of always crediting popular icons!

## - No spamming the same icon to the queue
Repeatedly submitting the same icon to the queue, whether it's already accepted or not, will get your spam rejected.
We recommend you join my (Sarah's) Discord Server to see updates on accepted/rejected icons to see any new additions, as well as see if your stuff was reviewed!

## - Format your submission properly
Failure to format your submission properly (Wrong icon format, wrong gamemode, medium quality files, etc) will most likely get your submission rejected.
Again, join the discord to know the reason your submission was rejected so you can re submit!

# Guidelines [ESP]
Icon Gallery es un proyecto bastante sencillo, por lo que las normas también lo son.
El incumplimiento de cualquiera de estas normas dará lugar al rechazo de tus iconos.
Ignorar estas reglas varias veces te impedirá enviar iconos por completo.

## - No se permite contenido NSFW
Los iconos enviados NO pueden contener **NINGÚN TIPO** de imágenes NSFW. Esto incluye, entre otros:
- Imágenes para adultos (el contenido sugerente se evaluará según su intensidad, pero es probable que sea rechazado).
- Lenguaje grosero (palabras malsonantes extremas en los nombres de los iconos, las descripciones o incluso en los propios iconos).
- Discurso de odio (CUALQUIER tipo de odio hacia cualquier grupo de personas, homofobia, transfobia, racismo, ya sea verbal o a través de imágenes).

## - No se permiten iconos robados
Al enviar un icono, aceptas y admites que:
- Eres el PROPIETARIO TOTAL del icono (lo creaste tú mismo o colaboraste en su creación y obtuviste permiso).
- Obtuviste permiso del autor original para enviar el icono.
Si estás enviando un ícono público y conocido bajo el nombre del artista original, lo más probable es que esté bien, ya que esto ayuda al objetivo de Icon Gallery de siempre dar crédito a los íconos populares.

## - No envíes el mismo ícono repetidamente a la cola
Enviar repetidamente el mismo ícono a la cola, ya sea que haya sido aceptado o no, hará que tu spam sea rechazado.
Te recomendamos que te unas a mi (de Sarah) servidor de Discord para ver las actualizaciones sobre los íconos aceptados/rechazados, así como para ver si se han añadido nuevos y si tu material ha sido revisado.

## - Formatea tu envío correctamente
Si no formateas tu envío correctamente (formato de icono incorrecto, modo de juego incorrecto, archivos de calidad media, etc.), lo más probable es que tu envío sea rechazado.
Una vez más, ¡únete al Discord para saber por qué se rechazó tu envío y así poder volver a enviarlo!
`;

function parseMarkdown(md) {
    return md.split('\n').map(line => {
        line = line.trim();
        if (!line) return '<br>';
        if (line.startsWith('### ')) return `<h3 class="font-pusab" style="margin-top:6px; margin-bottom:5px; font-size:1.2rem; color: #fbff00; paint-order: stroke fill; -webkit-text-stroke: 4px black;">${escapeHtml(line.slice(4))}</h3>`;
        if (line.startsWith('## ')) return `<h2 class="font-golden" style="margin-bottom:8px; font-size:1.7rem; -webkit-text-stroke: 1.45px black; filter: drop-shadow(2px 3px 0px rgba(0,0,0,0.3));">${escapeHtml(line.slice(3))}</h2>`;
        if (line.startsWith('# ')) return `<h1 class="font-pusab" style="margin-top:10px; margin-bottom:10px; font-size:2rem; -webkit-text-stroke: 7px black; filter: drop-shadow(3px 4px 0px rgba(0,0,0,0.3)); paint-order: stroke fill;">${escapeHtml(line.slice(2))}</h1>`;
        
        let parsedLine = escapeHtml(line).replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff;">$1</strong>');
        return `<p style="margin-bottom: 8px; line-height: 1.4; color: #e0e0e0;">${parsedLine}</p>`;
    }).join('');
}