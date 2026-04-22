// ═══════════════════════════════════════════════
// supabase-shared.js — единый клиент для всех страниц
// Подключай этот файл ПОСЛЕ @supabase/supabase-js
// ═══════════════════════════════════════════════

const SUPA_URL  = 'https://duorjhmhmqxushmldccv.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzYyMTgsImV4cCI6MjA5MjI1MjIxOH0.VQPga6s3Ft0Zvd5xRTS6cUfNi5gc-6YXfkU5YTKfRRM';
const SUPA_SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY3NjIxOCwiZXhwIjoyMDkyMjUyMjE4fQ.fVpM_MrQpxmZwzIFYMWq_R6JAG_rNMQvIJUMwId5lnk';

// Единственный anon-клиент — используется для auth + обычных запросов
const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    storageKey: 'turan-auth',          // фиксированный ключ — не конфликтует
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// Service-role клиент — ТОЛЬКО для admin-операций (создание юзеров, чтение всех профилей)
// НЕ имеет auth — только REST запросы
const sbAdmin = supabase.createClient(SUPA_URL, SUPA_SVC, {
  auth: {
    storageKey: 'turan-admin-noop',    // отдельный ключ — не конфликтует с sb
    persistSession: false,             // admin не хранит сессию
    autoRefreshToken: false
  },
  global: {
    headers: { Authorization: `Bearer ${SUPA_SVC}` }
  }
});
