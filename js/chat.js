// ============================================================================
// CHAT.JS - Модуль real-time чата
// ============================================================================

import { sb } from '../supabase-shared.js';
import { translateError, getCurrentUser, formatTime } from './utils.js';

let messageSubscription = null;

// Инициализация чата (teacher)
export async function initChat() {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    // Проверяем есть ли активная сессия
    let { data: session } = await sb
        .from('chat_sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
    
    // Если нет, создаём новую
    if (!session) {
        const { data, error } = await sb
            .from('chat_sessions')
            .insert({ teacher_id: user.id, status: 'active' })
            .select()
            .single();
        
        if (error) throw new Error(translateError(error));
        session = data;
    }
    
    return session;
}

// Отправка сообщения
export async function sendMessage(sessionId, text) {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await sb
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            sender_id: user.id,
            message_text: text.trim()
        })
        .select()
        .single();
    
    if (error) throw new Error(translateError(error));
    return data;
}

// Загрузка истории сообщений
export async function loadChatHistory(sessionId, limit = 50) {
    const { data, error } = await sb
        .from('chat_messages')
        .select(`
            *,
            sender:profiles!chat_messages_sender_id_fkey(
                id,
                full_name,
                username
            )
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);
    
    if (error) throw new Error(translateError(error));
    return data || [];
}

// Подписка на новые сообщения
export function subscribeToMessages(sessionId, callback) {
    // Отписываемся от предыдущей подписки
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    messageSubscription = sb
        .channel(`chat_${sessionId}`)
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `session_id=eq.${sessionId}`
            },
            async (payload) => {
                // Получаем информацию об отправителе
                const { data: sender } = await sb
                    .from('profiles')
                    .select('id, full_name, username')
                    .eq('id', payload.new.sender_id)
                    .single();
                
                callback({
                    ...payload.new,
                    sender
                });
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Subscribed to chat messages');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('Failed to subscribe to chat');
            }
        });
    
    return messageSubscription;
}

// Отписка от сообщений
export function unsubscribeFromMessages() {
    if (messageSubscription) {
        messageSubscription.unsubscribe();
        messageSubscription = null;
    }
}

// Пометка сообщений как прочитанных
export async function markAsRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return;
    
    const { error } = await sb
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', messageIds);
    
    if (error) throw new Error(translateError(error));
}

// Получение активных сессий (для admin)
export async function getActiveSessions() {
    const { data, error } = await sb
        .from('chat_sessions')
        .select(`
            *,
            teacher:profiles!chat_sessions_teacher_id_fkey(
                id,
                full_name,
                username
            ),
            unread_count:chat_messages(count)
        `)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
    
    if (error) throw new Error(translateError(error));
    return data || [];
}

// Получение количества непрочитанных сообщений
export async function getUnreadCount(sessionId) {
    const user = await getCurrentUser();
    if (!user) return 0;
    
    const { count, error } = await sb
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('is_read', false)
        .neq('sender_id', user.id);
    
    if (error) return 0;
    return count || 0;
}

// Закрытие сессии чата
export async function closeSession(sessionId) {
    const { error } = await sb
        .from('chat_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);
    
    if (error) throw new Error(translateError(error));
}

// Назначение админа на сессию
export async function assignAdmin(sessionId, adminId) {
    const { error } = await sb
        .from('chat_sessions')
        .update({ admin_id: adminId })
        .eq('id', sessionId);
    
    if (error) throw new Error(translateError(error));
}

// Рендеринг сообщения в HTML
export function renderMessage(message, currentUserId) {
    const isMine = message.sender_id === currentUserId;
    const time = formatTime(message.created_at);
    
    return `
        <div class="message ${isMine ? 'message-mine' : 'message-other'}">
            <div class="message-header">
                <span class="message-sender">${message.sender?.full_name || 'Unknown'}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.message_text)}</div>
        </div>
    `;
}

// Экранирование HTML для предотвращения XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
