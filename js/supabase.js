// js/supabase.js
const SUPABASE_URL = 'https://brlokemqzwzimyjiouzc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybG9rZW1xend6aW15amlvdXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMDQzMDYsImV4cCI6MjA5NTY4MDMwNn0.xWJ7B2xhX87DDbE1XWbuvUxlzdd7h8I15wPJn6NNocs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
