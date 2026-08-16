import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/index'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your .env file.')
}

const customFetch = async (url: string | Request | URL, options?: RequestInit) => {
  if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
    return new Response(JSON.stringify({ error: 'Supabase credentials missing', message: 'Veuillez configurer Supabase dans le fichier .env' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return fetch(url, options);
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    global: {
      fetch: customFetch
    }
  }
)
