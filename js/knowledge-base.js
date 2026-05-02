// ============================================================================
// KNOWLEDGE BASE - База знаний
// ============================================================================

let kbCards = [];
let currentCategory = '';

async function loadKnowledgeBase(){
  const {data, error} = await sb
    .from('knowledge_base_cards')
    .select('*')
    .eq('is_published', true)
    .order('display_order', {ascending: true});

  if(error){
    console.error('KB load error:', error);
    return;
  }

  kbCards = data || [];
  renderKB();
}

function renderKB(){
  const filtered = currentCategory 
    ? kbCards.filter(c => c.category === currentCategory)
    : kbCards;

  const container = document.getElementById('kb-cards');
  if(!container) return;

  if(filtered.length === 0){
    container.innerHTML = '<div style="text-align:center;color:var(--t3);padding:40px">Нет карточек в этой категории</div>';
    return;
  }

  container.innerHTML = filtered.map(card => `
    <div class="kb-card" onclick="openKBCard('${card.id}')">
      <div class="kb-card-title">${card.title}</div>
      <div class="kb-card-preview">${card.content.substring(0, 120)}...</div>
      <div class="kb-card-cat">${getCategoryLabel(card.category)}</div>
    </div>
  `).join('');
}

function filterKB(category){
  currentCategory = category;
  renderKB();

  // Обновляем активную кнопку
  document.querySelectorAll('.kb-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

function openKBCard(cardId){
  const card = kbCards.find(c => c.id === cardId);
  if(!card) return;

  document.getElementById('kb-modal-title').textContent = card.title;
  document.getElementById('kb-modal-content').textContent = card.content;
  document.getElementById('kb-modal-cat').textContent = getCategoryLabel(card.category);
  document.getElementById('kb-modal').classList.add('open');
}

function closeKBModal(){
  document.getElementById('kb-modal').classList.remove('open');
}

function getCategoryLabel(cat){
  const labels = {
    'security_methods': 'Методы защиты',
    'risk_matrix': 'Матрица рисков',
    'technical_protection': 'Технические средства',
    'incident_response': 'Реагирование на инциденты'
  };
  return labels[cat] || cat;
}

// Закрытие модального окна по клику вне его
document.addEventListener('click', e => {
  const modal = document.getElementById('kb-modal');
  if(e.target === modal){
    closeKBModal();
  }
});
