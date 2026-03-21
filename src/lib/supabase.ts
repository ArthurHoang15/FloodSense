import { createClient } from '@supabase/supabase-js'

// Anon client — used for direct Supabase calls from the browser (respects RLS)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
)

export default supabase
