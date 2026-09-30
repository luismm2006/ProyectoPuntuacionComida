const SUPABASE_URL = 'https://uwjtcvyljjgwuwhpaupd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-YB3D4DvsmPg1Q6eYepICA_MOwFTC2h';
const VOTES_API = `${SUPABASE_URL}/rest/v1/votos`;
const CLOUDINARY_CLOUD_NAME = 'b1ikwxql';
const CLOUDINARY_UPLOAD_PRESET = 'presetComida';
const CLOUDINARY_MAX_FILE_SIZE = 8 * 1024 * 1024;
const PEOPLE = ['Luis', 'Jose', 'Cristina', 'Arianna'];
const MEALS = [1, 2];

const elements = {
  todayLabel: document.querySelector('#today-label'),
  streakCount: document.querySelector('#streak-count'),
  streakUnit: document.querySelector('#streak-unit'),
  streakDetail: document.querySelector('#streak-detail'),
  todayCompletion: document.querySelector('#today-completion'),
  todayPeople: document.querySelector('#today-people'),
  todayWinner: document.querySelector('#today-winner'),
  entryCount: document.querySelector('#entry-count'),
  form: document.querySelector('#meal-form'),
  recordId: document.querySelector('#record-id'),
  date: document.querySelector('#meal-date'),
  voter: document.querySelector('#voter'),
  person: document.querySelector('#person'),
  mealNumber: document.querySelector('#meal-number'),
  foodName: document.querySelector('#food-name'),
  score: document.querySelector('#score'),
  saveButton: document.querySelector('#save-button'),
  cancelEdit: document.querySelector('#cancel-edit'),
  formMessage: document.querySelector('#form-message'),
  rankingList: document.querySelector('#ranking-list'),
  historyList: document.querySelector('#history-list'),
  clearData: document.querySelector('#clear-data')
};

let records = [];
let mealPhotos = [];
let photosTableAvailable = false;

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function shiftDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
}

function isValidDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

async function requestSupabase(path = '', options = {}, table = 'votos') {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.code || String(response.status));
  }
  return response.status === 204 ? [] : response.json();
}

async function loadRecords() {
  const rows = await requestSupabase('?select=*&order=fecha.asc');
  records = rows.map(row => ({
    id: row.id,
    fecha: row.fecha,
    votante: row.votante,
    persona: row.persona,
    comida: row.comida,
    nombreComida: row.nombre_comida,
    puntuacion: row.puntuacion
  }));
}

async function loadMealPhotos() {
  mealPhotos = await requestSupabase('?select=*&order=fecha.asc', {}, 'fotos_comidas');
  photosTableAvailable = true;
}

async function refreshData() {
  await loadRecords();
  try {
    await loadMealPhotos();
  } catch {
    mealPhotos = [];
    photosTableAvailable = false;
    showMessage('Los votos cargaron, pero las fotos necesitan la tabla public.fotos_comidas y sus políticas RLS.', true);
  }
}

async function saveVote(id, vote) {
  const row = {
    fecha: vote.fecha,
    votante: vote.votante,
    persona: vote.persona,
    comida: vote.comida,
    nombre_comida: vote.nombreComida,
    puntuacion: vote.puntuacion
  };
  const path = id ? `?id=eq.${encodeURIComponent(id)}` : '';
  return requestSupabase(path, {
    method: id ? 'PATCH' : 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
}

async function deleteVote(id) {
  return requestSupabase(`?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function deleteAllVotes() {
  return requestSupabase('?id=not.is.null', { method: 'DELETE' });
}

async function deleteAllMealPhotos() {
  return requestSupabase('?id=not.is.null', { method: 'DELETE' }, 'fotos_comidas');
}

async function uploadMealPhoto(file, date, person, meal) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Falta configurar cloud_name y el preset unsigned de Cloudinary en app.js.');
  }
  if (!photosTableAvailable) throw new Error('Ejecuta primero el SQL para crear public.fotos_comidas en Supabase.');
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  if (file.size > CLOUDINARY_MAX_FILE_SIZE) throw new Error('La imagen debe pesar menos de 8 MB.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });
  const uploaded = await response.json();
  if (!response.ok) throw new Error(uploaded.error?.message || 'Cloudinary rechazó la imagen.');

  const photo = {
    fecha: date,
    persona: person,
    comida: meal,
    foto_url: uploaded.secure_url,
    foto_public_id: uploaded.public_id
  };
  return requestSupabase('?on_conflict=fecha,persona,comida', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(photo)
  }, 'fotos_comidas');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function getVotes(date, person, meal) {
  return records.filter(record => record.fecha === date && record.persona === person && record.comida === meal);
}

function getPersonDay(person, date) {
  const meals = MEALS.map(meal => getVotes(date, person, meal));
  const complete = meals.every(votes => votes.length === PEOPLE.length - 1);
  const total = complete
    ? meals.flat().reduce((sum, vote) => sum + vote.puntuacion, 0)
    : null;
  return { meals, complete, total };
}

function getDay(date) {
  const people = PEOPLE.map(person => ({ person, ...getPersonDay(person, date) }));
  const completePeople = people.filter(person => person.complete);
  const highestScore = completePeople.length ? Math.max(...completePeople.map(person => person.total)) : null;
  const leaders = completePeople.filter(person => person.total === highestScore);
  return {
    people,
    complete: people.every(person => person.complete),
    leaders,
    highestScore
  };
}

function formatLongDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function showMessage(message, isError = false) {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle('error', isError);
}

function explainSupabaseError(error) {
  if (error.message === '23505') return 'Ese voto ya existe. Recarga los datos e inténtalo de nuevo.';
  if (['401', '403', '42501'].includes(error.message)) return 'Revisa las políticas RLS y los permisos de la tabla.';
  return 'Comprueba la conexión a Internet, la URL, la clave pública y que hayas ejecutado el SQL de Supabase.';
}

function resetForm() {
  const selectedVoter = elements.voter.value;
  elements.form.reset();
  elements.recordId.value = '';
  elements.date.value = todayKey();
  elements.voter.value = PEOPLE.includes(selectedVoter) ? selectedVoter : '';
  updatePersonOptions();
  updateVoterOptions(selectedVoter);
  elements.saveButton.textContent = 'Guardar voto';
  elements.cancelEdit.classList.add('hidden');
  showMessage('');
}

function updatePersonOptions(selectedPerson = '') {
  const availablePeople = PEOPLE.filter(person => person !== elements.voter.value);
  elements.person.innerHTML = '<option value="" disabled>Elige a quién puntuar</option>' +
    availablePeople.map(person => `<option value="${person}">${person}</option>`).join('');
  elements.person.value = availablePeople.includes(selectedPerson) ? selectedPerson : '';
}

function updateVoterOptions(selectedVoter = elements.voter.value) {
  const availableVoters = PEOPLE.filter(person => person !== elements.person.value);
  elements.voter.innerHTML = '<option value="" disabled>Elige quién eres</option>' +
    availableVoters.map(person => `<option value="${person}">${person}</option>`).join('');
  elements.voter.value = availableVoters.includes(selectedVoter) ? selectedVoter : '';
}

function renderToday(date) {
  const day = getDay(date);
  const count = records.filter(record => record.fecha === date).length;
  elements.todayLabel.textContent = `📅 Hoy, ${formatLongDate(date)}`;
  elements.todayCompletion.textContent = day.complete ? '✅ Día completo' : `⏳ ${count} de 24 votos`;
  elements.todayCompletion.classList.toggle('incomplete', !day.complete);
  elements.entryCount.textContent = `${count} de 24 votos hoy`;

  elements.todayPeople.innerHTML = day.people.map(({ person, meals, complete, total }) => `
    <article class="person-card">
      <div class="person-top">
        <h3 class="person-name">${person}</h3>
        <span class="person-total ${complete ? '' : 'pending'}">${complete ? `${total} / 60 puntos` : 'Incompleto'}</span>
      </div>
      <div class="meal-slots">
        ${meals.map((votes, index) => {
          const mealNumber = index + 1;
          const photo = mealPhotos.find(item => item.fecha === date && item.persona === person && item.comida === mealNumber);
          return `
          <div class="meal-slot ${votes.length === PEOPLE.length - 1 ? 'filled' : ''}">
            <div class="meal-slot-header">
              <span class="meal-slot-label">${votes.length === PEOPLE.length - 1 ? '✅' : '⏳'} Comida ${mealNumber}</span>
              <span class="vote-count">${votes.length} de 3 votos</span>
            </div>
            ${photo ? `<img class="meal-photo" src="${escapeHtml(photo.foto_url)}" alt="Foto de ${person}, Comida ${mealNumber}" loading="lazy">` : ''}
            <div class="photo-controls">
              <button class="photo-button" type="button" data-photo-upload>📷 ${photo ? 'Cambiar foto' : 'Añadir foto'}</button>
              <input class="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-photo-person="${person}" data-photo-meal="${mealNumber}" aria-label="Subir foto de ${person}, Comida ${mealNumber}">
            </div>
            <div class="meal-votes">
              ${votes.map(vote => `
                <div class="meal-vote">
                  <span class="meal-slot-info" title="${escapeHtml(vote.nombreComida)}"><strong>${escapeHtml(vote.votante)}</strong>: ${vote.puntuacion}/10 · ${escapeHtml(vote.nombreComida)}</span>
                  <span class="slot-actions">
                    <button class="icon-button" type="button" data-edit="${escapeHtml(vote.id)}" aria-label="Editar voto de ${escapeHtml(vote.votante)} para ${escapeHtml(vote.persona)}, comida ${vote.comida}" title="Editar">✎</button>
                    <button class="icon-button delete" type="button" data-delete="${escapeHtml(vote.id)}" aria-label="Eliminar voto de ${escapeHtml(vote.votante)} para ${escapeHtml(vote.persona)}, comida ${vote.comida}" title="Eliminar">×</button>
                  </span>
                </div>`).join('')}
              ${votes.length < PEOPLE.length - 1 ? `<span class="meal-slot-info">Pendiente: ${PEOPLE.filter(voter => voter !== person && !votes.some(vote => vote.votante === voter)).join(', ')}</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </article>`).join('');

  renderWinner(day);
}

function renderWinner(day) {
  const isTie = day.leaders.length > 1;
  const hasLeader = day.leaders.length > 0;
  const leadingNames = day.leaders.map(person => person.person).join(', ');
  const title = !hasLeader
    ? 'Aún no hay ganador'
    : isTie
      ? `${day.complete ? '🤝 Empate' : '🤝 Empate provisional'}`
      : day.complete
        ? `🏆 ${leadingNames}`
        : `🏆 Va en cabeza: ${leadingNames}`;
  const rows = day.people.map(person => `
    <div class="winner-row ${day.leaders.includes(person) ? 'top' : ''}">
      <span>${person.person}</span>
      <span>${person.complete ? `${person.total} puntos` : '<span class="winner-state">Incompleto</span>'}</span>
    </div>`).join('');

  elements.todayWinner.innerHTML = `
    <p class="winner-kicker">${day.complete ? 'Resultado del día' : 'Marcador de hoy'}</p>
    <h3 class="winner-title">${title}</h3>
    ${hasLeader ? `<p class="winner-points">${day.highestScore} de 60 puntos${day.complete ? '' : ' · provisional'}</p>` : '<p class="winner-empty">Cada persona necesita los seis votos para entrar en la puntuación del día.</p>'}
    <div class="winner-list">${rows}</div>`;
}

function renderStreak() {
  let streak = 0;
  let date = todayKey();
  while (getDay(date).complete) {
    streak += 1;
    date = shiftDateKey(date, -1);
  }
  elements.streakCount.textContent = streak;
  elements.streakUnit.textContent = streak === 1 ? 'día' : 'días';
  elements.streakDetail.textContent = streak
    ? 'Los 24 votos completos, día tras día'
    : 'Completa los 24 votos de hoy para empezar';
}

function renderRanking() {
  const ranking = PEOPLE.map((person, order) => {
    let points = 0;
    let wins = 0;
    const dates = [...new Set(records.filter(record => record.persona === person).map(record => record.fecha))];
    dates.forEach(date => {
      const dayPerson = getPersonDay(person, date);
      if (dayPerson.complete) points += dayPerson.total;
    });
    const allDates = [...new Set(records.map(record => record.fecha))];
    allDates.forEach(date => {
      const day = getDay(date);
      if (day.leaders.some(leader => leader.person === person)) wins += 1;
    });
    return { person, points, wins, streak: getPersonStreak(person), order };
  }).sort((first, second) => second.points - first.points || first.order - second.order);

  let currentRank = 0;
  let previousPoints = null;
  elements.rankingList.innerHTML = ranking.map((entry, index) => {
    if (entry.points !== previousPoints) currentRank = index + 1;
    previousPoints = entry.points;
    const tied = ranking.filter(other => other.points === entry.points).length > 1;
    const medalClass = currentRank <= 3 ? ['first', 'second', 'third'][currentRank - 1] : '';
    return `
      <div class="ranking-row">
        <span class="rank-position ${medalClass}">${currentRank}</span>
        <span class="rank-name">${entry.person}${tied ? '<span class="rank-tie"> · empate</span>' : ''}</span>
        <span class="rank-stat points"><strong>${entry.points}</strong>puntos</span>
        <span class="rank-stat"><strong>${entry.wins}</strong>días ganados</span>
        <span class="rank-stat"><strong>${entry.streak}</strong>racha</span>
      </div>`;
  }).join('');
}

function getPersonStreak(person) {
  let streak = 0;
  let date = todayKey();
  while (getPersonDay(person, date).complete) {
    streak += 1;
    date = shiftDateKey(date, -1);
  }
  return streak;
}

function renderHistory() {
  const dates = [...new Set(records.map(record => record.fecha))]
    .filter(date => date !== todayKey())
    .sort((first, second) => second.localeCompare(first));

  if (!dates.length) {
    elements.historyList.innerHTML = '<p class="history-empty">Todavía no hay días anteriores en el historial.</p>';
    return;
  }

  elements.historyList.innerHTML = dates.map(date => {
    const day = getDay(date);
    const winner = day.leaders.length === 0
      ? 'Sin ganador'
      : day.leaders.length > 1
        ? `🤝 ${day.complete ? 'Empate' : 'Empate provisional'}: ${day.leaders.map(person => person.person).join(', ')}`
        : `🏆 ${day.leaders[0].person} · ${day.highestScore} puntos${day.complete ? '' : ' (provisional)'}`;
    const scores = day.people.map(person => `
      <div class="history-person">
        <strong>${person.person}</strong>
        <span>${person.complete ? `${person.total} / 60 puntos` : 'Incompleto'}</span>
      </div>`).join('');
    const voteDetails = day.people.flatMap(person => person.meals.map((votes, index) => {
      const photo = mealPhotos.find(item => item.fecha === date && item.persona === person.person && item.comida === index + 1);
      const voters = PEOPLE.filter(voter => voter !== person.person).map(voter => {
        const vote = votes.find(item => item.votante === voter);
        return `<div class="history-vote-row">
          <span>${voter}: ${vote ? `${vote.puntuacion}/10 · ${escapeHtml(vote.nombreComida)}` : 'Pendiente'}</span>
          ${vote ? `<span class="slot-actions">
            <button class="icon-button" type="button" data-edit="${escapeHtml(vote.id)}" aria-label="Editar voto de ${voter} para ${person.person}, comida ${index + 1}" title="Editar">✎</button>
            <button class="icon-button delete" type="button" data-delete="${escapeHtml(vote.id)}" aria-label="Eliminar voto de ${voter} para ${person.person}, comida ${index + 1}" title="Eliminar">×</button>
          </span>` : ''}
        </div>`;
      }).join('');
      return `<div class="history-vote-group">
        <strong>${person.person} · Comida ${index + 1}</strong>
        ${photo ? `<img class="history-meal-photo" src="${escapeHtml(photo.foto_url)}" alt="Foto de ${person.person}, Comida ${index + 1}" loading="lazy">` : ''}
        ${voters}
      </div>`;
    })).join('');

    return `
      <details class="history-day">
        <summary class="history-summary">
          <span class="history-date">${formatLongDate(date)}</span>
          <span class="history-winner">${winner}</span>
          <span class="history-state ${day.complete ? 'complete' : ''}">${day.complete ? '✅ Completo' : '⏳ Incompleto'}</span>
          <span class="history-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="history-details">
          <div class="history-score-grid">${scores}</div>
          <div class="history-votes">${voteDetails}</div>
        </div>
      </details>`;
  }).join('');
}

function render() {
  const today = todayKey();
  renderToday(today);
  renderStreak();
  renderRanking();
  renderHistory();
}

elements.form.addEventListener('submit', async event => {
  event.preventDefault();
  const id = elements.recordId.value;
  const scoreInput = elements.score.value;
  const score = Number(scoreInput);
  const date = elements.date.value;
  const voter = elements.voter.value;
  const person = elements.person.value;
  const meal = Number(elements.mealNumber.value);

  if (!isValidDateKey(date) || !PEOPLE.includes(voter) || !PEOPLE.includes(person) || voter === person || !MEALS.includes(meal) || scoreInput === '' || !Number.isFinite(score) || score < 0 || score > 10) {
    showMessage('Revisa la fecha y la valoración: debe ser un número entre 0 y 10.', true);
    return;
  }

  const duplicate = records.find(record =>
    record.fecha === date && record.votante === voter && record.persona === person && record.comida === meal && record.id !== id
  );
  if (duplicate) {
    showMessage(`${voter} ya ha puntuado la Comida ${meal} de ${person} ese día.`, true);
    return;
  }

  const nextRecord = {
    fecha: date,
    votante: voter,
    persona: person,
    comida: meal,
    nombreComida: elements.foodName.value.trim(),
    puntuacion: score
  };
  if (!nextRecord.nombreComida) {
    showMessage('Escribe el nombre o la descripción de la comida.', true);
    return;
  }

  try {
    await saveVote(id, nextRecord);
    await refreshData();
    resetForm();
    showMessage(id ? 'Voto actualizado.' : 'Voto guardado.');
    render();
  } catch (error) {
    showMessage(`No se pudo guardar el voto. ${explainSupabaseError(error)}`, true);
  }
});

async function handleRecordActions(event) {
  const editId = event.target.closest('[data-edit]')?.dataset.edit;
  const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
  if (editId) {
    const record = records.find(item => item.id === editId);
    if (!record) return;
    elements.recordId.value = record.id;
    elements.date.value = record.fecha;
    elements.voter.value = '';
    updatePersonOptions();
    elements.person.value = record.persona;
    updateVoterOptions(record.votante);
    elements.mealNumber.value = String(record.comida);
    elements.foodName.value = record.nombreComida;
    elements.score.value = String(record.puntuacion);
    elements.saveButton.textContent = 'Guardar cambios';
    elements.cancelEdit.classList.remove('hidden');
    showMessage(`Editando el voto de ${record.votante} para ${record.persona}, Comida ${record.comida}.`);
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (deleteId) {
    const record = records.find(item => item.id === deleteId);
    if (!record || !window.confirm(`¿Eliminar el voto de ${record.votante} para ${record.persona}, Comida ${record.comida}?`)) return;
    try {
      await deleteVote(deleteId);
      await refreshData();
      if (elements.recordId.value === deleteId) resetForm();
      showMessage('Voto eliminado.');
      render();
    } catch (error) {
      showMessage(`No se pudo eliminar el voto. ${explainSupabaseError(error)}`, true);
    }
  }
}

elements.todayPeople.addEventListener('click', handleRecordActions);
elements.historyList.addEventListener('click', handleRecordActions);
elements.todayPeople.addEventListener('click', event => {
  if (!event.target.closest('[data-photo-upload]')) return;
  event.target.closest('.meal-slot').querySelector('.photo-input').click();
});
elements.todayPeople.addEventListener('change', async event => {
  const input = event.target.closest('.photo-input');
  const file = input?.files[0];
  if (!input || !file) return;
  const person = input.dataset.photoPerson;
  const meal = Number(input.dataset.photoMeal);
  showMessage(`Subiendo la foto de ${person}, Comida ${meal}...`);
  try {
    await uploadMealPhoto(file, todayKey(), person, meal);
    await loadMealPhotos();
    render();
    showMessage(`Foto guardada para ${person}, Comida ${meal}.`);
  } catch (error) {
    showMessage(`No se pudo guardar la foto. ${error.message}`, true);
  } finally {
    input.value = '';
  }
});
elements.voter.addEventListener('change', () => {
  updatePersonOptions();
  updateVoterOptions();
});
elements.person.addEventListener('change', () => updateVoterOptions());

elements.cancelEdit.addEventListener('click', resetForm);

elements.clearData.addEventListener('click', async () => {
  if (!records.length) {
    showMessage('No hay datos para borrar.');
    return;
  }
  if (!window.confirm('Esto eliminará los votos compartidos y las referencias a sus fotos de todos. Los archivos ya subidos seguirán en Cloudinary. ¿Seguro que quieres continuar? Esta acción no se puede deshacer.')) return;
  try {
    await deleteAllVotes();
    if (photosTableAvailable) await deleteAllMealPhotos();
    await refreshData();
    resetForm();
    showMessage('Se han eliminado los votos y las referencias a las fotos. Los archivos siguen en Cloudinary.');
    render();
  } catch (error) {
    showMessage(`No se pudieron eliminar los votos. ${explainSupabaseError(error)}`, true);
  }
});

elements.date.value = todayKey();
updatePersonOptions();
updateVoterOptions();
render();
refreshData()
  .then(render)
  .catch(error => showMessage(`No se pudieron cargar los votos de Supabase. ${explainSupabaseError(error)}`, true));

window.addEventListener('focus', () => {
  refreshData()
    .then(render)
    .catch(error => showMessage(`No se pudieron actualizar los votos. ${explainSupabaseError(error)}`, true));
});