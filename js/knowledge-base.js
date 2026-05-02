// ============================================================================
// KNOWLEDGE-BASE.JS - Модуль справочной информации
// ============================================================================

import { sb } from '../supabase-shared.js';
import { translateError } from './utils.js';

// Получение всех опубликованных карточек
export async function getPublishedCards() {
    const { data, error } = await sb
        .from('knowledge_base_cards')
        .select('*')
        .eq('is_published', true)
        .order('category')
        .order('display_order');
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data || [];
}

// Получение карточек по категории
export async function getCardsByCategory(category) {
    const { data, error } = await sb
        .from('knowledge_base_cards')
        .select('*')
        .eq('category', category)
        .eq('is_published', true)
        .order('display_order');
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data || [];
}

// Группировка карточек по категориям
export function groupCardsByCategory(cards) {
    const categories = {
        security_methods: { 
            title: 'Методы и средства информационной безопасности', 
            cards: [],
            icon: '🔒'
        },
        risk_matrix: { 
            title: 'Матрица анализа рисков', 
            cards: [],
            icon: '📊'
        },
        technical_protection: { 
            title: 'Выбор мер технической защиты', 
            cards: [],
            icon: '🛡️'
        },
        incident_response: { 
            title: 'Разработка политики реагирования на инциденты', 
            cards: [],
            icon: '🚨'
        }
    };
    
    cards.forEach(card => {
        if (categories[card.category]) {
            categories[card.category].cards.push(card);
        }
    });
    
    return categories;
}

// Создание карточки (admin only)
export async function createCard(cardData) {
    const { data, error } = await sb
        .from('knowledge_base_cards')
        .insert({
            title: cardData.title.trim(),
            content: cardData.content.trim(),
            category: cardData.category,
            display_order: cardData.display_order || 0,
            is_published: cardData.is_published !== false
        })
        .select()
        .single();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data;
}

// Обновление карточки (admin only)
export async function updateCard(cardId, cardData) {
    const { data, error } = await sb
        .from('knowledge_base_cards')
        .update({
            title: cardData.title?.trim(),
            content: cardData.content?.trim(),
            category: cardData.category,
            display_order: cardData.display_order,
            is_published: cardData.is_published
        })
        .eq('id', cardId)
        .select()
        .single();
    
    if (error) {
        throw new Error(translateError(error));
    }
    
    return data;
}

// Удаление карточки (admin only)
export async function deleteCard(cardId) {
    const { error } = await sb
        .from('knowledge_base_cards')
        .delete()
        .eq('id', cardId);
    
    if (error) {
        throw new Error(translateError(error));
    }
}

// Рендеринг карточки в HTML
export function renderCard(card) {
    return `
        <div class="kb-card" data-card-id="${card.id}">
            <h3 class="kb-card-title">${escapeHtml(card.title)}</h3>
            <p class="kb-card-content">${escapeHtml(card.content)}</p>
        </div>
    `;
}

// Рендеринг категории с карточками
export function renderCategory(category, data) {
    if (data.cards.length === 0) return '';
    
    return `
        <section class="kb-category" data-category="${category}">
            <h2 class="kb-category-title">
                <span class="kb-category-icon">${data.icon}</span>
                ${data.title}
            </h2>
            <div class="kb-cards">
                ${data.cards.map(card => renderCard(card)).join('')}
            </div>
        </section>
    `;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Поиск по карточкам
export function searchCards(cards, query) {
    if (!query || query.trim() === '') return cards;
    
    const lowerQuery = query.toLowerCase().trim();
    
    return cards.filter(card => 
        card.title.toLowerCase().includes(lowerQuery) ||
        card.content.toLowerCase().includes(lowerQuery)
    );
}
