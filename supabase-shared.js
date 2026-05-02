// TURAN — Supabase клиент
const SUPA_URL  = 'https://duorjhmhmqxushmldccv.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3JqaG1obXF4dXNobWxkY2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzYyMTgsImV4cCI6MjA5MjI1MjIxOH0.VQPga6s3Ft0Zvd5xRTS6cUfNi5gc-6YXfkU5YTKfRRM';

// Основной клиент для всех операций
const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    storageKey: 'turan-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
