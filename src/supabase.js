import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xvxyzwhzpxelzuczeiwm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2eHl6d2h6cHhlbHp1Y3plaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NzkzNDEsImV4cCI6MjA2NjQ1NTM0MX0.EonU3kF76V_iWvIUMxgKd3HjGoW6henjd1uvxrUF-ag'
)
