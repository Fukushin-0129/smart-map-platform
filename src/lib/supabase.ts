import { createClient } from '@supabase/supabase-js'
import { appConfig } from './config'

export const supabase =
  appConfig.supabaseUrl && appConfig.supabaseAnonKey
    ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey)
    : null
