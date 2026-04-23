// ═══════════════════════════════════════════════
// supabase-shared.js — единый клиент для всех страниц
// Подключай этот файл ПОСЛЕ @supabase/supabase-js
// ═══════════════════════════════════════════════

const SUPA_URL  = 'https://duorjhmhmqxushmldccv.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzYyMTgsImV4cCI6MjA5MjI1MjIxOH0.VQPga6s3Ft0Zvd5xRTS6cUfNi5gc-6YXfkU5YTKfRRM';

// ⚠️  ВАЖНО: service_role ключ НЕЛЬЗЯ хранить на клиентской стороне!
// Он даёт полный доступ к базе в обход всех RLS-политик и виден в DevTools.
// Все права управляются через RLS-политики и триггеры в Supabase.

const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    storageKey: 'turan-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// sbAdmin = алиас на sb (для обратной совместимости).
// Реальные привилегированные операции — через триггеры и RLS в Supabase.
const sbAdmin = sb;
