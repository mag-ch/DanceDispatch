import { createClient } from '@supabase/supabase-js'
const supabase = createClient('url', 'anonKey')
// ---cut---
const { error } = await supabase.auth.verifyOtp({
  token_hash: 'hash',
  type: 'email',
})