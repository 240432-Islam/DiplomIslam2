// ============================================================================
// UTILS.JS - Утилиты и вспомогательные функции
// ============================================================================

import { sb } from '../supabase-shared.js';

// Форматирование даты ("2 дня назад", "вчера", "14.01.2025")
export function formatDate(timestamp) {
    if (!timestamp) return '—';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// Форматирование времени ("14:30")
export function formatTime(timestamp) {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Перевод ошибок на русский
export function translateError(error) {
    const errorMap = {
        'Invalid login credentials': 'Неверный логин или пароль',
        'Email not confirmed': 'Email не подтверждён. Обратитесь к администратору',
        'User already registered': 'Этот логин уже занят',
        'Network request failed': 'Ошибка сети. Проверьте подключение',
        'Permission denied': 'У вас нет прав для выполнения этой операции',
        'Invalid access code': 'Код доступа не найден. Проверьте правильность ввода',
        'Group is archived': 'Эта группа архивирована и не принимает новых студентов',
        'Only students can enroll in groups': 'Только студенты могут записываться в группы',
        'This group is archived': 'Эта группа архивирована'
    };
    
    const message = error?.message || error?.error || String(error);
    
    for (const [key, value] of Object.entries(errorMap)) {
        if (message.includes(key)) {
            return value;
        }
    }
    
    return 'Произошла ошибка. Попробуйте ещё раз или обратитесь к администратору';
}

// Валидация пароля
export function validatePassword(password, policy) {
    const errors = [];
    
    if (password.length < (policy?.min_length || 8)) {
        errors.push(`Минимум ${policy?.min_length || 8} символов`);
    }
    if (policy?.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Требуется заглавная буква');
    }
    if (policy?.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Требуется строчная буква');
    }
    if (policy?.require_numbers && !/[0-9]/.test(password)) {
        errors.push('Требуется цифра');
    }
    if (policy?.require_symbols && !/[!@#$%^&*]/.test(password)) {
        errors.push('Требуется символ (!@#$%^&*)');
    }
    
    return { valid: errors.length === 0, errors };
}

// Генерация логина из ФИО (транслитерация)
export function generateUsername(fullName) {
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    const parts = fullName.trim().toLowerCase().split(/\s+/);
    if (parts.length === 0) return '';
    
    let username = '';
    for (const char of parts.join('_')) {
        username += translitMap[char] || char;
    }
    
    return username.replace(/[^a-z0-9_]/g, '');
}

// Показ уведомлений (toast)
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Логирование в audit_logs
export async function logAudit(eventType, description) {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        
        const { data: profile } = await sb
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
        
        await sb.from('audit_logs').insert({
            user_id: user.id,
            username: profile?.username || user.email,
            event_type: eventType,
            description,
            status: 'success'
        });
    } catch (error) {
        console.error('Audit log failed:', error);
    }
}

// Retry с exponential backoff
export async function fetchWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}

// Получение текущего пользователя
export async function getCurrentUser() {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return null;
    
    const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return { ...user, ...profile };
}

// Проверка роли пользователя
export async function checkRole(requiredRole) {
    const user = await getCurrentUser();
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
        return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
}

// Добавление стилей для анимации toast
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
