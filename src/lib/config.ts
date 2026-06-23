export const appConfig = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const
