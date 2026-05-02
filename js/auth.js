// ============================================================================
// AUTH.JS - Модуль аутентификации
// ============================================================================

import { sb } from '../supabase-shared.js';
import { translateError, logAudit, generateUsername } from './utils.js';

// Вход в систему
export async function login(username, password) {
    const email = username.includes('@') ? username : `${username}@turan.kz`;
    
    const { data, error } = await sb.auth.signInWithPassword({ 
        email, 
        password 
    });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    // Обновляем last_login
    await updateLastLogin(data.user.id);
    
    // Логируем вход
    await logAudit('login', `User logged in: ${username}`);
    
    return { user: data.user, session: data.session };
}

// Регистрация нового пользователя
export async function register(userData) {
    const { fullName, username, password, role, department } = userData;
    
    // Генерируем email
    const email = `${username}@turan.kz`;
    
    // Создаём пользователя
    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                username,
                role: role || 'student',
                department: department || ''
            }
        }
    });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    // Логируем регистрацию
    await logAudit('register', `New user registered: ${username} (${role})`);
    
    return data;
}

// Выход из системы
export async function logout() {
    await logAudit('logout', 'User logged out');
    const { error } = await sb.auth.signOut();
    if (error) {
        throw new Error(translateError(error));
    }
}

// Обновление last_login
export async function updateLastLogin(userId) {
    await sb
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
}

// Получение текущего пользователя с профилем
export async function getCurrentUser() {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) return null;
    
    const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    return profile ? { ...user, ...profile } : null;
}

// Смена пароля
export async function updatePassword(newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    await logAudit('password_change', 'Password changed successfully');
}

// Проверка сессии
export async function checkSession() {
    const { data: { session }, error } = await sb.auth.getSession();
    return session && !error;
}

// Автоматический редирект при истечении сессии
sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('index.html')) {
            window.location.href = 'login.html';
        }
    }
});
