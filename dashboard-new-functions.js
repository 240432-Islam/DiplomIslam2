// ═══════════════════════════════════════════════════════════════
// НОВЫЕ ФУНКЦИИ ДЛЯ DASHBOARD
// Скопируйте этот код в конец <script> в dashboard.html (перед </script>)
// ═══════════════════════════════════════════════════════════════

// ═══════ СПРАВОЧНАЯ (Knowledge Base) ═══════
let kbCards = [];
let kbFilter = '';

async function loadKnowledgeBase() {
  const { data, error } = await sb
    .from('knowledge_base_cards')
    .select('*')
    .eq('is_published', true)
    .order('display_order');
  
  if (error) {
    console.error('KB error:', error);
    return;
  }
  
  kbCards = data || [];
  renderKnowledgeBase();
}

function renderKnowledgeBase() {
  const filtered = kbFilter
    ? kbCards.filter(c => c.category === kbFilter)
    : kbCards;
  
  const categoryLabels = {
    methods: '🛡️ Методы и средства ИБ',
    risk_matrix: '📊 Матрица рисков',
    technical_measures: '🔧 Технические меры',
    incident_response: '🚨 Реагирование на инциденты'
  };
  
  const html = filtered.map(card => `
    <div class="kb-card" onclick="openKbCard('${card.id}')">
      <div class="kb-cat">${categoryLabels[card.category] || card.category}</div>
      <div class="kb-title">${card.title}</div>
    </div>
  `).join('');
  
  document.getElementById('kb-list').innerHTML = html || '<p style="color:var(--t3);text-align:center;padding:40px">Нет статей</p>';
}

function filterKb(cat) {
  kbFilter = cat;
  renderKnowledgeBase();
  
  document.querySelectorAll('.kb-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
}

function openKbCard(id) {
  const card = kbCards.find(c => c.id === id);
  if (!card) return;
  
  document.getElementById('kb-modal-title').textContent = card.title;
  document.getElementById('kb-modal-content').innerHTML = card.content;
  document.getElementById('m-kb').classList.add('open');
}

// ═══════ ГРУППЫ (для teacher) ═══════
let groups = [];
let selectedGroup = null;

async function loadGroups() {
  if (me?.role !== 'teacher') return;
  
  const { data, error } = await sb
    .from('groups')
    .select('*')
    .eq('teacher_id', me.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Groups error:', error);
    return;
  }
  
  groups = data || [];
  renderGroupsDropdown();
}

function renderGroupsDropdown() {
  const select = document.getElementById('group-select');
  if (!select) return;
  
  const html = '<option value="">— Выберите группу —</option>' + 
    groups.map(g => `<option value="${g.id}">${g.name} (${g.access_code || 'без кода'})</option>`).join('');
  
  select.innerHTML = html;
}

async function loadGroupStudents() {
  const select = document.getElementById('group-select');
  const groupId = select.value;
  
  if (!groupId) {
    document.getElementById('group-students').innerHTML = '';
    return;
  }
  
  selectedGroup = groups.find(g => g.id === groupId);
  
  const { data, error } = await sb
    .from('group_enrollments')
    .select(`
      student_id,
      enrolled_at,
      profiles:student_id (
        id,
        full_name,
        username,
        last_login,
        created_at
      )
    `)
    .eq('group_id', groupId);
  
  if (error) {
    console.error('Students error:', error);
    return;
  }
  
  const students = data || [];
  
  if (students.length === 0) {
    document.getElementById('group-students').innerHTML = '<p style="color:var(--t3);text-align:center;padding:20px">В группе пока нет студентов</p>';
    return;
  }
  
  const html = `
    <div class="card-title">Студенты группы "${selectedGroup.name}" (${students.length})</div>
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Логин</th>
            <th>Зарегистрирован</th>
            <th>Последний вход</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const p = s.profiles;
            return `
              <tr>
                <td class="bold">${p.full_name || p.username}</td>
                <td>${p.username}</td>
                <td>${fmtDate(p.created_at)}</td>
                <td>${p.last_login ? fmtDate(p.last_login) : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('group-students').innerHTML = html;
}

// ═══════ ЧАТ С АДМИНОМ ═══════
let chatSession = null;
let chatMessages = [];
let chatSubscription = null;

async function openChat() {
  // Проверяем есть ли уже активная сессия
  const { data: existing } = await sb
    .from('chat_sessions')
    .select('*')
    .or(`teacher_id.eq.${me.id},student_id.eq.${me.id}`)
    .eq('status', 'active')
    .maybeSingle();
  
  if (existing) {
    chatSession = existing;
  } else {
    // Создаём новую сессию
    const payload = me.role === 'teacher' 
      ? { teacher_id: me.id, status: 'active' }
      : { student_id: me.id, status: 'active' };
    
    const { data: newSession, error } = await sb
      .from('chat_sessions')
      .insert(payload)
      .select()
      .single();
    
    if (error) {
      toast('Ошибка создания чата', 'e');
      return;
    }
    
    chatSession = newSession;
  }
  
  await loadChatMessages();
  subscribeToChatMessages();
  
  document.getElementById('m-chat').classList.add('open');
  document.getElementById('chat-input').focus();
}

async function loadChatMessages() {
  if (!chatSession) return;
  
  const { data, error } = await sb
    .from('chat_messages')
    .select('*')
    .eq('session_id', chatSession.id)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Chat messages error:', error);
    return;
  }
  
  chatMessages = data || [];
  renderChatMessages();
  
  // Отмечаем как прочитанные
  await sb
    .from('chat_messages')
    .update({ is_read: true })
    .eq('session_id', chatSession.id)
    .neq('sender_id', me.id);
}

function renderChatMessages() {
  const html = chatMessages.map(msg => {
    const isMine = msg.sender_id === me.id;
    return `
      <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
        <div class="chat-msg-text">${escapeHtml(msg.message_text)}</div>
        <div class="chat-msg-time">${fmtTime(msg.created_at)}</div>
      </div>
    `;
  }).join('');
  
  const container = document.getElementById('chat-messages');
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function subscribeToChatMessages() {
  if (chatSubscription) {
    chatSubscription.unsubscribe();
  }
  
  chatSubscription = sb
    .channel(`chat:${chatSession.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `session_id=eq.${chatSession.id}`
    }, payload => {
      chatMessages.push(payload.new);
      renderChatMessages();
      
      if (payload.new.sender_id !== me.id) {
        sb.from('chat_messages')
          .update({ is_read: true })
          .eq('id', payload.new.id)
          .then(() => {});
      }
    })
    .subscribe();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  if (!text || !chatSession) return;
  
  const { error } = await sb
    .from('chat_messages')
    .insert({
      session_id: chatSession.id,
      sender_id: me.id,
      message_text: text,
      is_read: false
    });
  
  if (error) {
    toast('Ошибка отправки', 'e');
    return;
  }
  
  input.value = '';
}

function closeChat() {
  if (chatSubscription) {
    chatSubscription.unsubscribe();
    chatSubscription = null;
  }
  
  chatSession = null;
  chatMessages = [];
  document.getElementById('m-chat').classList.remove('open');
}

// ═══════ АДМИН: ВСЕ ЧАТЫ ═══════
let allChatSessions = [];

async function loadAllChats() {
  if (me?.role !== 'admin') return;
  
  const { data, error } = await sb.rpc('get_all_chat_sessions');
  
  if (error) {
    console.error('All chats error:', error);
    return;
  }
  
  allChatSessions = data || [];
  renderAllChats();
}

function renderAllChats() {
  const html = allChatSessions.map(s => {
    const userName = s.teacher_name || s.student_name || '—';
    const userRole = s.teacher_id ? 'Преподаватель' : 'Студент';
    
    return `
      <tr onclick="openAdminChat('${s.id}')" style="cursor:pointer">
        <td class="bold">${userName}</td>
        <td>${userRole}</td>
        <td>${s.status === 'active' ? '<span class="badge b-green">Активен</span>' : '<span class="badge b-gray">Закрыт</span>'}</td>
        <td>${fmtDateTime(s.updated_at)}</td>
        <td>${s.unread_count > 0 ? `<span class="badge b-blue">${s.unread_count}</span>` : '—'}</td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('chats-tbody').innerHTML = html || `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px">Нет чатов</td></tr>`;
}

async function openAdminChat(sessionId) {
  const session = allChatSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  chatSession = session;
  await loadChatMessages();
  subscribeToChatMessages();
  
  document.getElementById('m-chat').classList.add('open');
  document.getElementById('chat-input').focus();
}

// ═══════ УТИЛИТЫ ═══════
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function evLabel(type) {
  const labels = {
    login: 'Вход',
    logout: 'Выход',
    register: 'Регистрация',
    password_change: 'Смена пароля',
    user_created: 'Создание пользователя',
    policy_updated: 'Обновление политики'
  };
  return labels[type] || type;
}

function toast(msg, type = 'i') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show t-${type}`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'm-chat') closeChat();
}

// ═══════ ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ФУНКЦИЙ ═══════

// Обновляем nav() чтобы загружать новые view
const originalNav = nav;
nav = function(id) {
  originalNav(id);
  
  if (id === 'v-kb') loadKnowledgeBase();
  if (id === 'v-groups') loadGroups();
  if (id === 'v-chats') loadAllChats();
};

// Обновляем renderSidebar() чтобы показывать кнопки
const originalRenderSidebar = renderSidebar;
renderSidebar = function() {
  originalRenderSidebar();
  
  // Показываем кнопку чата для teacher и student
  const chatBtn = document.getElementById('chat-btn');
  if (chatBtn) {
    chatBtn.style.display = (me?.role === 'teacher' || me?.role === 'student') ? '' : 'none';
  }
  
  // Показываем секцию групп для teacher
  if (me?.role === 'teacher') {
    const sec = document.getElementById('teacher-sec');
    const groups = document.getElementById('teacher-groups');
    if (sec) sec.style.display = '';
    if (groups) groups.style.display = '';
  }
};

// Обновляем init() чтобы загружать новые фичи
const originalInit = init;
init = async function() {
  await originalInit();
  
  // Загружаем справочную для всех
  await loadKnowledgeBase();
  
  // Загружаем группы для преподавателей
  if (me?.role === 'teacher') {
    await loadGroups();
  }
  
  // Загружаем чаты для админа
  if (me?.role === 'admin') {
    await loadAllChats();
  }
};
