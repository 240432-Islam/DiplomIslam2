// ============================================================================
// GROUPS.JS - Модуль управления группами
// ============================================================================

import { sb } from '../supabase-shared.js';
import { translateError, logAudit, getCurrentUser } from './utils.js';

// Создание группы (teacher)
export async function createGroup(name) {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await sb
        .from('groups')
        .insert({
            teacher_id: user.id,
            name: name.trim()
        })
        .select()
        .single();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    await logAudit('group_created', `Created group: ${name} (code: ${data.access_code})`);
    return data;
}

// Получение групп текущего преподавателя
export async function getMyGroups(includeArchived = false) {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    let query = sb
        .from('groups')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
    
    if (!includeArchived) {
        query = query.eq('is_archived', false);
    }
    
    const { data, error } = await query;
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data || [];
}

// Получение студентов группы
export async function getGroupStudents(groupId) {
    const { data, error } = await sb
        .from('group_enrollments')
        .select(`
            *,
            student:profiles!group_enrollments_student_id_fkey(
                id,
                full_name,
                username,
                created_at,
                last_login
            )
        `)
        .eq('group_id', groupId)
        .order('enrolled_at', { ascending: false });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data?.map(e => ({
        ...e.student,
        enrolled_at: e.enrolled_at
    })) || [];
}

// Получение количества студентов в группе
export async function getGroupStudentCount(groupId) {
    const { count, error } = await sb
        .from('group_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return count || 0;
}

// Архивирование группы
export async function archiveGroup(groupId) {
    const { data, error } = await sb
        .from('groups')
        .update({ is_archived: true })
        .eq('id', groupId)
        .select()
        .single();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    await logAudit('group_archived', `Archived group: ${data.name}`);
    return data;
}

// Восстановление группы из архива
export async function restoreGroup(groupId) {
    const { data, error } = await sb
        .from('groups')
        .update({ is_archived: false })
        .eq('id', groupId)
        .select()
        .single();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    await logAudit('group_restored', `Restored group: ${data.name}`);
    return data;
}

// Запись студента в группу по коду доступа
export async function enrollStudent(accessCode) {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await sb.rpc('enroll_student_in_group', {
        p_access_code: accessCode.toUpperCase().trim(),
        p_student_id: user.id
    });
    
    if (error || !data?.success) {
        throw new Error(translateError(data?.error || error));
    }
    
    await logAudit('student_enrolled', `Enrolled in group with code: ${accessCode}`);
    return data;
}

// Получение группы студента
export async function getMyGroup() {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await sb
        .from('group_enrollments')
        .select(`
            *,
            group:groups(
                id,
                name,
                access_code,
                created_at,
                teacher:profiles!groups_teacher_id_fkey(
                    id,
                    full_name,
                    username,
                    department
                )
            )
        `)
        .eq('student_id', user.id)
        .maybeSingle();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data?.group || null;
}

// Получение одногруппников (для студента)
export async function getClassmates() {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    // Сначала получаем группу студента
    const { data: enrollment } = await sb
        .from('group_enrollments')
        .select('group_id')
        .eq('student_id', user.id)
        .maybeSingle();
    
    if (!enrollment) return [];
    
    // Получаем всех студентов этой группы кроме текущего
    const { data, error } = await sb
        .from('group_enrollments')
        .select(`
            *,
            student:profiles!group_enrollments_student_id_fkey(
                id,
                full_name,
                username,
                last_login
            )
        `)
        .eq('group_id', enrollment.group_id)
        .neq('student_id', user.id)
        .order('enrolled_at', { ascending: true });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data?.map(e => e.student) || [];
}

// Выход из группы (для студента)
export async function leaveGroup() {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    const { error } = await sb
        .from('group_enrollments')
        .delete()
        .eq('student_id', user.id);
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    await logAudit('student_left_group', 'Student left group');
}

// Получение всех групп (для admin)
export async function getAllGroups() {
    const { data, error } = await sb
        .from('groups')
        .select(`
            *,
            teacher:profiles!groups_teacher_id_fkey(
                id,
                full_name,
                username
            )
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data || [];
}
