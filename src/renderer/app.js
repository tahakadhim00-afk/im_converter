// ── State ──
let files = [];
let outputFolder = null;

// ── DOM ──
const dropZone = document.getElementById('drop-zone');
const btnSelect = document.getElementById('btn-select');
const btnAddMore = document.getElementById('btn-add-more');
const btnClear = document.getElementById('btn-clear');
const fileListContainer = document.getElementById('file-list-container');
const fileList = document.getElementById('file-list');
const fileCount = document.getElementById('file-count');
const formatSelect = document.getElementById('format-select');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const qualityHint = document.getElementById('quality-hint');
const resizeWidth = document.getElementById('resize-width');
const resizeHeight = document.getElementById('resize-height');
const keepMetadata = document.getElementById('keep-metadata');
const btnOutputFolder = document.getElementById('btn-output-folder');
const btnResetFolder = document.getElementById('btn-reset-folder');
const outputFolderDisplay = document.getElementById('output-folder-display');
const btnConvert = document.getElementById('btn-convert');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultsSection = document.getElementById('results-section');
const resultsSummary = document.getElementById('results-summary');
const btnOpenFolder = document.getElementById('btn-open-folder');
const themeToggle = document.getElementById('theme-toggle');

// ── Init ──
async function init() {
  const formats = await window.api.getFormats();
  formatSelect.innerHTML = formats
    .map((f) => `<option value="${f.id}">${f.label} (${f.ext})</option>`)
    .join('');
  updateQualityVisibility();

  // Restore theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

init();

// ── Theme Toggle ──
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Format Change ──
formatSelect.addEventListener('change', updateQualityVisibility);

function updateQualityVisibility() {
  const formats = ['jpeg', 'webp', 'avif'];
  const isLossy = formats.includes(formatSelect.value);
  qualitySlider.disabled = !isLossy;
  qualityHint.textContent = isLossy
    ? 'Applies to JPG, WebP, and AVIF'
    : 'Not applicable for this format';
  qualitySlider.style.opacity = isLossy ? '1' : '0.4';
}

// ── Quality Slider ──
qualitySlider.addEventListener('input', () => {
  qualityValue.textContent = qualitySlider.value + '%';
});

// ── File Selection ──
btnSelect.addEventListener('click', async (e) => {
  e.stopPropagation();
  const selected = await window.api.selectFiles();
  if (selected.length) addFiles(selected);
});

btnAddMore.addEventListener('click', async () => {
  const selected = await window.api.selectFiles();
  if (selected.length) addFiles(selected);
});

btnClear.addEventListener('click', () => {
  files = [];
  renderFiles();
});

// ── Drag & Drop ──
dropZone.addEventListener('click', async () => {
  const selected = await window.api.selectFiles();
  if (selected.length) addFiles(selected);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const droppedFiles = Array.from(e.dataTransfer.files)
    .filter((f) => isImageFile(f.name))
    .map((f) => f.path);
  if (droppedFiles.length) addFiles(droppedFiles);
});

// Also handle drag on the whole window when file list is showing
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (files.length > 0) {
    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter((f) => isImageFile(f.name))
      .map((f) => f.path);
    if (droppedFiles.length) addFiles(droppedFiles);
  }
});

function isImageFile(name) {
  const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif', '.ico', '.svg'];
  return exts.some((ext) => name.toLowerCase().endsWith(ext));
}

// ── File Management ──
function addFiles(newPaths) {
  const existing = new Set(files.map((f) => f.path));
  for (const p of newPaths) {
    if (!existing.has(p)) {
      files.push({ path: p, name: fileName(p), ext: fileExt(p), size: null });
    }
  }
  renderFiles();
}

function removeFile(index) {
  files.splice(index, 1);
  renderFiles();
}

function renderFiles() {
  const hasFiles = files.length > 0;
  dropZone.classList.toggle('hidden', hasFiles);
  fileListContainer.classList.toggle('hidden', !hasFiles);
  btnConvert.disabled = !hasFiles;

  fileCount.textContent = files.length + (files.length === 1 ? ' file' : ' files');

  fileList.innerHTML = files
    .map(
      (f, i) => `
    <li class="file-item">
      <span class="file-ext">${f.ext}</span>
      <span class="file-name" title="${f.path}">${f.name}</span>
      <button class="file-remove" data-index="${i}" title="Remove">&times;</button>
    </li>`
    )
    .join('');

  // Attach remove handlers
  fileList.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.index)));
  });

  // Hide results when file list changes
  resultsSection.classList.add('hidden');
}

function fileName(p) {
  return p.split(/[\\/]/).pop();
}

function fileExt(p) {
  const parts = p.split('.');
  return parts.length > 1 ? parts.pop().toUpperCase() : '?';
}

// ── Output Folder ──
btnOutputFolder.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    outputFolder = folder;
    outputFolderDisplay.textContent = folder;
    outputFolderDisplay.title = folder;
    btnResetFolder.classList.remove('hidden');
  }
});

btnResetFolder.addEventListener('click', () => {
  outputFolder = null;
  outputFolderDisplay.textContent = 'Same as source';
  outputFolderDisplay.title = '';
  btnResetFolder.classList.add('hidden');
});

// ── Conversion ──
btnConvert.addEventListener('click', startConversion);

async function startConversion() {
  if (files.length === 0) return;

  const options = {
    quality: parseInt(qualitySlider.value),
    width: resizeWidth.value ? parseInt(resizeWidth.value) : null,
    height: resizeHeight.value ? parseInt(resizeHeight.value) : null,
    keepMetadata: keepMetadata.checked,
  };

  // UI state: converting
  btnConvert.disabled = true;
  btnConvert.textContent = 'Converting...';
  progressSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = 'Starting...';

  try {
    const results = await window.api.convert({
      files: files.map((f) => f.path),
      outputFormat: formatSelect.value,
      outputDir: outputFolder,
      options,
    });

    showResults(results);
  } catch (err) {
    progressText.textContent = 'Error: ' + err.message;
  } finally {
    btnConvert.disabled = false;
    btnConvert.textContent = 'Convert';
  }
}

// ── Progress Callback ──
window.api.onProgress(({ current, total, file }) => {
  const pct = Math.round((current / total) * 100);
  progressBar.style.width = pct + '%';
  progressText.textContent = `Converting ${current} of ${total}: ${file}`;
});

// ── Results ──
function showResults(results) {
  progressSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  const success = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success);

  let html = `<span class="success-count">${success} converted</span>`;
  if (errors.length > 0) {
    html += ` &middot; <span class="error-count">${errors.length} failed</span>`;
    html += '<br><small>' + errors.map((e) => fileName(e.file) + ': ' + e.error).join('<br>') + '</small>';
  }
  resultsSummary.innerHTML = html;

  // Determine output folder to open
  if (results.length > 0 && results[0].success) {
    const firstOutput = results[0].outputPath;
    const folder = firstOutput.substring(0, firstOutput.lastIndexOf('\\')) || firstOutput.substring(0, firstOutput.lastIndexOf('/'));
    btnOpenFolder.onclick = () => window.api.openFolder(folder);
    btnOpenFolder.classList.remove('hidden');
  }
}
