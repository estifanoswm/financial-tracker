// js/supabase.js
if (!window.SUPABASE_CONFIG) throw new Error('Missing js/config.js: run `npm run build`');

const { createClient } = supabase;
const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
