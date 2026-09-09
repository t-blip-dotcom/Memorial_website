const SUPABASE_URL = "https://qonbpfhyjnlogenysjxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbmJwZmh5am5sb2dlbnlzanhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MTg0ODIsImV4cCI6MjEwMzk5NDQ4Mn0.a7pHD0gIOFZlxsSitxqL6capT3v7CCL5puWQ3CYM7Gc";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const addMemoryBtn = document.getElementById('add-memory-btn');
const formContainer = document.getElementById('memory-form-container');
const submitBtn = document.getElementById('submit-memory-btn');
const toast = document.getElementById('toast');

/* ---------- Custom popup (replaces alert()) ---------- */
let toastTimer = null;
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = 'toast toast-' + type + ' toast-visible';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 4200);
}

/* ---------- Load a chosen file into an <img> we can draw from ---------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Draw an image onto a canvas, rotated by any angle ----------
   Handles both 90-degree turns and small fine-tune straightening
   angles, expanding the canvas so nothing gets cropped off. */
function drawRotated(img, angleDegrees) {
  const angle = (angleDegrees * Math.PI) / 180;
  const w = img.width;
  const h = img.height;
  const newW = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  const newH = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(angle);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas;
}

/* ---------- Shrink a canvas down to a sane max width ----------
   Phone camera photos are often 3-10MB, far larger than a
   webpage needs. Resizing before uploading makes submissions
   much faster and keeps the photo bucket well within the free
   storage limit, while still looking sharp at the size the
   cards actually display them. */
function canvasToCompressedFile(canvas, fileName, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const scale = Math.min(1, maxWidth / canvas.width);
    let finalCanvas = canvas;
    if (scale < 1) {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width * scale;
      finalCanvas.height = canvas.height * scale;
      finalCanvas.getContext('2d').drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
    }
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Could not process image'));
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality
    );
  });
}

/* ---------- Straighten / rotate preview ---------- */
const photoInput = document.getElementById('memory-photo');
const previewWrap = document.getElementById('photo-preview-wrap');
const previewImg = document.getElementById('photo-preview');
const rotateLeftBtn = document.getElementById('rotate-left');
const rotateRightBtn = document.getElementById('rotate-right');

let loadedImg = null;
let rotation = 0; // multiples of 90

function refreshPreview() {
  if (!loadedImg) return;
  const canvas = drawRotated(loadedImg, rotation);
  previewImg.src = canvas.toDataURL('image/jpeg', 0.85);
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) {
    previewWrap.classList.remove('active');
    loadedImg = null;
    return;
  }
  rotation = 0;
  loadedImg = await loadImage(file);
  previewWrap.classList.add('active');
  refreshPreview();
});

rotateLeftBtn.addEventListener('click', () => {
  rotation -= 90;
  refreshPreview();
});

rotateRightBtn.addEventListener('click', () => {
  rotation += 90;
  refreshPreview();
});

/* ---------- Full-size photo popup ---------- */
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('lightbox-open');
}

document.getElementById('lightbox-close').addEventListener('click', () => {
  lightbox.classList.remove('lightbox-open');
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) lightbox.classList.remove('lightbox-open');
});

/* Wire up any existing placeholder cards already in the HTML */
document.querySelectorAll('.card img').forEach((img) => {
  img.addEventListener('click', () => openLightbox(img.src));
});

addMemoryBtn.addEventListener('click', () => {
  formContainer.classList.add('modal-open');
});

document.getElementById('close-modal').addEventListener('click', () => {
  formContainer.classList.remove('modal-open');
});

formContainer.addEventListener('click', (e) => {
  if (e.target === formContainer) formContainer.classList.remove('modal-open');
});

submitBtn.addEventListener('click', async () => {
  const description = document.getElementById('memory-description').value.trim();
  const photoFile = document.getElementById('memory-photo').files[0];

  if (!description && !photoFile) {
    showToast('Please add a description and choose a photo.', 'error');
    return;
  }
  if (!description) {
    showToast('Please add a description.', 'error');
    return;
  }
  if (!photoFile) {
    showToast('Please choose a photo.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const rotatedCanvas = drawRotated(loadedImg, rotation);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const compressedFile = await canvasToCompressedFile(rotatedCanvas, fileName);

    const { error: uploadError } = await supabaseClient
      .storage
      .from('memorial-photos')
      .upload(fileName, compressedFile);

    if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message);

    const { data: urlData } = supabaseClient
      .storage
      .from('memorial-photos')
      .getPublicUrl(fileName);

    const { error: insertError } = await supabaseClient
      .from('memorial')
      .insert([{
        memory_name: description,
        image_url: urlData.publicUrl,
        approval_status: false
      }]);

    if (insertError) throw new Error('Could not save your memory: ' + insertError.message);

    showToast('Thank you. Your memory will appear once approved.', 'success');
    formContainer.classList.remove('modal-open');
    document.getElementById('memory-description').value = '';
    document.getElementById('memory-photo').value = '';
    previewWrap.classList.remove('active');
    loadedImg = null;
    rotation = 0;
  } catch (err) {
    showToast(err.message, 'error');
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit';
});

async function loadMemories() {
  const { data, error } = await supabaseClient
    .from('memorial')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading memories:', error);
    return;
  }

  const cardsContainer = document.querySelector('.cards');

  data.forEach((memory) => {
    const card = document.createElement('div');
    card.classList.add('card');

    const img = document.createElement('img');
    img.src = memory.image_url;
    img.alt = 'image of memory';
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(img.src));

    const desc = document.createElement('p');
    desc.textContent = memory.memory_name;

    card.appendChild(img);
    card.appendChild(desc);

    cardsContainer.insertBefore(card, addMemoryBtn);
  });
}

async function loadGallery() {
  const { data, error } = await supabaseClient
    .storage
    .from('gallery-photos')
    .list('', { sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    console.error('Error loading gallery:', error);
    return;
  }

  const gallery = document.getElementById('gallery');

  data
    .filter((file) => file.name && !file.name.startsWith('.'))
    .forEach((file) => {
      const { data: urlData } = supabaseClient
        .storage
        .from('gallery-photos')
        .getPublicUrl(file.name);

      const img = document.createElement('img');
      img.src = urlData.publicUrl;
      img.alt = 'family photo';
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(img.src));

      gallery.appendChild(img);
    });
}

loadMemories();
loadGallery();