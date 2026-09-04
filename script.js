const SUPABASE_URL = "https://qonbpfhyjnlogenysjxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbmJwZmh5am5sb2dlbnlzanhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MTg0ODIsImV4cCI6MjEwMzk5NDQ4Mn0.a7pHD0gIOFZlxsSitxqL6capT3v7CCL5puWQ3CYM7Gc";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const addMemoryBtn = document.getElementById('add-memory-btn');
const formContainer = document.getElementById('memory-form-container');
const submitBtn = document.getElementById('submit-memory-btn');

addMemoryBtn.addEventListener('click', () => {
  formContainer.style.display = formContainer.style.display === 'none' ? 'flex' : 'none';
});

document.getElementById('close-modal').addEventListener('click', () => {
  formContainer.style.display = 'none';
});

submitBtn.addEventListener('click', async () => {
  const description = document.getElementById('memory-description').value.trim();
  const photoFile = document.getElementById('memory-photo').files[0];

  if (!description || !photoFile) {
    alert('Please add a description and choose a photo.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const fileExt = photoFile.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from('memory-photos')
    .upload(fileName, photoFile);

  if (uploadError) {
    alert('Photo upload failed: ' + uploadError.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    return;
  }

  const { data: urlData } = supabaseClient
    .storage
    .from('memory-photos')
    .getPublicUrl(fileName);

  const { error: insertError } = await supabaseClient
    .from('memories')
    .insert([{
      memory_name: description,
      photo_url: urlData.publicUrl,
      approval_status: false
    }]);

  if (insertError) {
    alert('Something went wrong saving your memory: ' + insertError.message);
  } else {
    alert('Thank you! Your memory will appear once approved.');
    formContainer.style.display = 'none';
    document.getElementById('memory-description').value = '';
    document.getElementById('memory-photo').value = '';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit';
});