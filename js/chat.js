// ============================================================================
// CHAT.JS - Модуль чата с администратором
// ============================================================================

let chatSession = null;
let chatSubscription = null;
let currentUser = null;

// Инициализация чата
export async function initChat(user) {
    currentUser = user;
    
    if (user.role === 'teacher') {
        await loadOrCreateTeacherSession();
    } else if (user.role === 'admin') {
        await loadAdminSessions();
    }
}

// Загрузка или создание сессии для преподавателя
async function loadOrCreateTeacherSession() {
    // Ищем активную сессию
    const { data: existing } = await sb
        .from('chat_sessions')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('status', 'active')
        .maybeSingle();
    
    if (existing) {
        chatSession = existing;
    } else {
        // Создаём новую сессию
        const { data: newSession, error } = await sb
            .from('chat_sessions')
            .insert({
                teacher_id: currentUser.id,
                status: 'active'
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating chat session:', error);
            return;
        }
        
        chatSession = newSession;
    }
    
    await loadMessages();
    subscribeToMessages();
}

// Загрузка всех активных сессий для админа
async function loadAdminSessions() {
    const { data: sessions, error } = await sb
        .from('chat_sessions')
        .select(`
            *,
            teacher:profiles!chat_sessions_teacher_id_fkey(
                id,
                full_name,
                username
            )
        `)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
    
    if (error) {
        console.error('Error loading sessions:', error);
        return;
    }
    
    return sessions || [];
}

// Загрузка сообщений
async function loadMessages() {
    if (!chatSession) return [];
    
    const { data: messages, error } = await sb
        .from('chat_messages')
        .select(`
            *,
            sender:profiles!chat_messages_sender_id_fkey(
                id,
                full_name,
                username
            )
        `)
        .eq('session_id', chatSession.id)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error loading messages:', error);
        return [];
    }
    
    // Отмечаем сообщения как прочитанные
    await markAsRead();
    
    return messages || [];
}

// Отправка сообщения
export async function sendMessage(text) {
    if (!chatSession || !text.trim()) return null;
    
    const { data, error } = await sb
        .from('chat_messages')
        .insert({
            session_id: chatSession.id,
            sender_id: currentUser.id,
            message_text: text.trim(),
            is_read: false
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error sending message:', error);
        throw new Error('Ошибка отправки сообщения');
    }
    
    return data;
}

// Отметить сообщения как прочитанные
async function markAsRead() {
    if (!chatSession) return;
    
    await sb
        .from('chat_messages')
        .update({ is_read: true })
        .eq('session_id', chatSession.id)
        .neq('sender_id', currentUser.id);
}

// Подписка на новые сообщения (realtime)
function subscribeToMessages() {
    if (!chatSession) return;
    
    chatSubscription = sb
        .channel(`chat:${chatSession.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${chatSession.id}`
        }, payload => {
            // Обновляем UI при получении нового сообщения
            if (window.onNewMessage) {
                window.onNewMessage(payload.new);
            }
        })
        .subscribe();
}

// Отписка от realtime
export function unsubscribeChat() {
    if (chatSubscription) {
        chatSubscription.unsubscribe();
        chatSubscription = null;
    }
}

// Получение количества непрочитанных сообщений
export async function getUnreadCount() {
    if (!currentUser) return 0;
    
    let query;
    
    if (currentUser.role === 'teacher') {
        // Для преподавателя: непрочитанные сообщения в его активной сессии
        const { data: session } = await sb
            .from('chat_sessions')
            .select('id')
            .eq('teacher_id', currentUser.id)
            .eq('status', 'active')
            .maybeSingle();
        
        if (!session) return 0;
        
        query = sb
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .eq('is_read', false)
            .neq('sender_id', currentUser.id);
    } else if (currentUser.role === 'admin') {
        // Для админа: все непрочитанные сообщения во всех активных сессиях
        query = sb
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false)
            .neq('sender_id', currentUser.id);
    } else {
        return 0;
    }
    
    const { count } = await query;
    return count || 0;
}

// Закрытие сессии (для админа)
export async function closeSession(sessionId) {
    const { error } = await sb
        .from('chat_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);
    
    if (error) {
        console.error('Error closing session:', error);
        throw new Error('Ошибка закрытия сессии');
    }
}
