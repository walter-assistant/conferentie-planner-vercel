import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ziqaretckjagqpxpkkdi.supabase.co'
const supabaseAnonKey = 'sb_publishable_0mJ1lwEIejHKgCxenHNFog_g1cmxxKX'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Conference {
  id: string
  name: string
  data: any
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ConferenceVersion {
  id: string
  conference_id: string
  name: string | null
  data: any
  created_by: string | null
  created_at: string
}

// Helper functions for conference operations
export const conferenceService = {
  // Get all conferences
  async getConferences(): Promise<Conference[]> {
    const { data, error } = await supabase
      .from('conferences')
      .select('*')
      .order('updated_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Get a single conference by ID
  async getConference(id: string): Promise<Conference | null> {
    const { data, error } = await supabase
      .from('conferences')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  },

  // Create new conference
  async createConference(name: string, data: any): Promise<Conference> {
    const { data: user } = await supabase.auth.getUser()
    
    const { data: result, error } = await supabase
      .from('conferences')
      .insert({
        name,
        data,
        created_by: user.user?.id,
        updated_by: user.user?.id
      })
      .select()
      .single()
    
    if (error) throw error
    return result
  },

  // Update conference
  async updateConference(id: string, name: string, data: any): Promise<Conference> {
    const { data: user } = await supabase.auth.getUser()
    
    const { data: result, error } = await supabase
      .from('conferences')
      .update({
        name,
        data,
        updated_by: user.user?.id
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return result
  },

  // Delete conference
  async deleteConference(id: string): Promise<void> {
    const { error } = await supabase
      .from('conferences')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  // Get versions for a conference
  async getVersions(conferenceId: string): Promise<ConferenceVersion[]> {
    const { data, error } = await supabase
      .from('conference_versions')
      .select('*')
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // Save new version
  async saveVersion(conferenceId: string, name: string, data: any): Promise<ConferenceVersion> {
    const { data: user } = await supabase.auth.getUser()
    
    // First check if we have too many versions (limit to 50)
    const { data: existingVersions } = await supabase
      .from('conference_versions')
      .select('id')
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: false })
    
    if (existingVersions && existingVersions.length >= 50) {
      // Delete oldest versions
      const toDelete = existingVersions.slice(49) // Keep newest 49, delete the rest
      const idsToDelete = toDelete.map(v => v.id)
      
      if (idsToDelete.length > 0) {
        await supabase
          .from('conference_versions')
          .delete()
          .in('id', idsToDelete)
      }
    }
    
    // Create new version
    const { data: result, error } = await supabase
      .from('conference_versions')
      .insert({
        conference_id: conferenceId,
        name,
        data,
        created_by: user.user?.id
      })
      .select()
      .single()
    
    if (error) throw error
    return result
  },

  // Delete a version
  async deleteVersion(versionId: string): Promise<void> {
    const { error } = await supabase
      .from('conference_versions')
      .delete()
      .eq('id', versionId)
    
    if (error) throw error
  }
}

// Auth helpers
export const authService = {
  // Sign up
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    return { data, error }
  },

  // Sign in
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Get current user
  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
}