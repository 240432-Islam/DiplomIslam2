// TURAN — Supabase клиенты
const SUPA_URL  = 'https://duorjhmhmqxushmldccv.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzYyMTgsImV4cCI6MjA5MjI1MjIxOH0.VQPga6s3Ft0Zvd5xRTS6cUfNi5gc-6YXfkU5YTKfRRM';
const SUPA_SVC  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY3NjIxOCwiZXhwIjoyMDkyMjUyMjE4fQ.fVpM_MrQpxmZwzIFYMWq_R6JAG_rNMQvIJUMwId5lnk';

// Основной клиент — для всех операций текущего пользователя
const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    storageKey: 'turan-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// Service-role клиент — ТОЛЬКО для Auth Admin API (создание пользователей)
// persistSession: false — не конфликтует с основной сессией
const sbSvc = supabase.createClient(SUPA_URL, SUPA_SVC, {
  auth: {
    storageKey: 'turan-svc-noop',
    persistSession: false,
    autoRefreshToken: false
  }
});
