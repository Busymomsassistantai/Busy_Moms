/*
  # Generate Daily Affirmation Edge Function

  1. Purpose
    - Generate personalized daily affirmations using OpenAI
    - Aggregate user context (calendar, tasks, family, shopping)
    - Store generated affirmations in the database

  2. Security
    - Requires JWT authentication
    - Users can only generate affirmations for themselves
    - OpenAI API key stored securely in environment

  3. Request Format
    - POST with optional date parameter
    - Automatically fetches user's context data
    - Respects user's affirmation settings

  4. Response Format
    - Returns generated affirmation object
    - Includes affirmation text and metadata
*/

import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

interface AffirmationRequest {
  date?: string;
  forceRegenerate?: boolean;
}

interface AffirmationResponse {
  id: string;
  affirmation_text: string;
  generated_date: string;
  data_sources: any;
  viewed: boolean;
  favorited: boolean;
  created_at: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`🚀 Affirmation generation request - ${req.method} ${req.url}`);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log('✅ Authenticated user:', user.id);

    const body: AffirmationRequest = await req.json().catch(() => ({}));

    let targetDate = body.date || new Date().toISOString().split('T')[0];
    if (body.date && isNaN(Date.parse(body.date))) {
      return new Response(
        JSON.stringify({ error: "Invalid date format" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const forceRegenerate = body.forceRegenerate || false;

    if (!forceRegenerate) {
      const { data: existingAffirmation } = await supabase
        .from('affirmations')
        .select('*')
        .eq('user_id', user.id)
        .eq('generated_date', targetDate)
        .maybeSingle();

      if (existingAffirmation) {
        console.log('📋 Found existing affirmation for date:', targetDate);
        return new Response(
          JSON.stringify(existingAffirmation),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    const { data: settings } = await supabase
      .from('affirmation_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settings && !settings.enabled) {
      return new Response(
        JSON.stringify({ error: "Affirmations are disabled for this user" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🔍 Fetching user context data...');

    const contextData: any = {
      calendar: [],
      tasks: [],
      shopping: [],
      family: [],
      profile: null,
    };

    const includeCalendar = settings?.include_calendar !== false;
    const includeTasks = settings?.include_tasks !== false;
    const includeShopping = settings?.include_shopping !== false;
    const includeFamily = settings?.include_family !== false;

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const queries = [];

    if (includeCalendar) {
      queries.push(
        supabase
          .from('events')
          .select('title, event_date, start_time, location, description')
          .eq('user_id', user.id)
          .gte('event_date', today)
          .lte('event_date', nextWeek)
          .order('event_date', { ascending: true })
          .limit(5)
          .then(({ data }) => ({ key: 'calendar', data: data || [] }))
      );
    }

    if (includeTasks) {
      queries.push(
        supabase
          .from('shopping_lists')
          .select('item, category, urgent')
          .eq('user_id', user.id)
          .eq('completed', false)
          .order('created_at', { ascending: false })
          .limit(10)
          .then(({ data }) => ({ key: 'tasks', data: data || [] }))
      );
    }

    if (includeShopping) {
      queries.push(
        supabase
          .from('shopping_lists')
          .select('item, quantity, category')
          .eq('user_id', user.id)
          .eq('completed', false)
          .limit(8)
          .then(({ data }) => ({ key: 'shopping', data: data || [] }))
      );
    }

    if (includeFamily) {
      queries.push(
        supabase
          .from('family_members')
          .select('name, age, gender')
          .eq('user_id', user.id)
          .then(({ data }) => ({ key: 'family', data: data || [] }))
      );
    }

    queries.push(
      supabase
        .from('profiles')
        .select('full_name, user_type, ai_personality')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => ({ key: 'profile', data }))
    );

    const results = await Promise.all(queries);
    results.forEach(result => {
      contextData[result.key] = result.data;
    });

    console.log('📊 Context data collected:', {
      calendar: contextData.calendar.length,
      tasks: contextData.tasks.length,
      shopping: contextData.shopping.length,
      family: contextData.family.length,
    });

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('⚠️ OpenAI API key not configured, using fallback affirmation');
      const fallbackAffirmation = generateFallbackAffirmation(contextData);
      
      const { data: newAffirmation, error: insertError } = await supabase
        .from('affirmations')
        .insert({
          user_id: user.id,
          affirmation_text: fallbackAffirmation,
          generated_date: targetDate,
          data_sources: {
            calendar: includeCalendar,
            tasks: includeTasks,
            shopping: includeShopping,
            family: includeFamily,
            fallback: true,
          },
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify(newAffirmation),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log('🤖 Generating affirmation with OpenAI...');
    const prompt = buildAffirmationPrompt(contextData);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a compassionate AI assistant that generates personalized daily affirmations for busy parents. Create positive, uplifting affirmations that acknowledge their challenges and celebrate their strengths.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error('Failed to generate affirmation with OpenAI');
    }

    const openaiData = await openaiResponse.json();
    const affirmationText = openaiData.choices[0]?.message?.content?.trim() || generateFallbackAffirmation(contextData);

    console.log('✅ Generated affirmation:', affirmationText.substring(0, 50) + '...');

    if (forceRegenerate) {
      const { error: deleteError } = await supabase
        .from('affirmations')
        .delete()
        .eq('user_id', user.id)
        .eq('generated_date', targetDate);

      if (deleteError) {
        console.warn('⚠️ Could not delete existing affirmation:', deleteError);
      }
    }

    const { data: newAffirmation, error: insertError } = await supabase
      .from('affirmations')
      .insert({
        user_id: user.id,
        affirmation_text: affirmationText,
        generated_date: targetDate,
        data_sources: {
          calendar: includeCalendar,
          tasks: includeTasks,
          shopping: includeShopping,
          family: includeFamily,
          ai_generated: true,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting affirmation:', insertError);
      throw insertError;
    }

    console.log('✅ Affirmation saved to database');

    return new Response(
      JSON.stringify(newAffirmation),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('❌ Affirmation generation error:', error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred while generating affirmation"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});

function buildAffirmationPrompt(contextData: any): string {
  const userName = contextData.profile?.full_name || 'there';
  const userType = contextData.profile?.user_type || 'parent';
  const personality = contextData.profile?.ai_personality || 'Friendly';
  
  let prompt = `Generate a personalized daily affirmation for ${userName}, a ${userType}.\n\n`;
  
  prompt += `Personality: ${personality}\n\n`;
  
  if (contextData.calendar.length > 0) {
    prompt += `Upcoming events:\n`;
    contextData.calendar.forEach((event: any) => {
      prompt += `- ${event.title} on ${event.event_date}${event.start_time ? ' at ' + event.start_time : ''}\n`;
    });
    prompt += `\n`;
  }
  
  if (contextData.tasks.length > 0) {
    prompt += `Tasks to complete:\n`;
    contextData.tasks.slice(0, 5).forEach((task: any) => {
      prompt += `- ${task.item}${task.urgent ? ' (urgent)' : ''}\n`;
    });
    prompt += `\n`;
  }
  
  if (contextData.family.length > 0) {
    prompt += `Family members:\n`;
    contextData.family.forEach((member: any) => {
      const ageInfo = member.age ? `, age ${member.age}` : '';
      const genderInfo = member.gender ? ` (${member.gender})` : '';
      prompt += `- ${member.name}${ageInfo}${genderInfo}\n`;
    });
    prompt += `\n`;
  }
  
  if (contextData.shopping.length > 0) {
    prompt += `Shopping needs: ${contextData.shopping.length} items on the list\n\n`;
  }
  
  prompt += `Create a positive, encouraging affirmation (2-3 sentences max) that:\n`;
  prompt += `1. Acknowledges their current situation and responsibilities\n`;
  prompt += `2. Provides encouragement and validation\n`;
  prompt += `3. Inspires confidence for the day ahead\n`;
  prompt += `4. Uses a warm, ${personality.toLowerCase()} tone\n\n`;
  prompt += `Return ONLY the affirmation text, no quotes or extra formatting.`;
  
  return prompt;
}

function generateFallbackAffirmation(contextData: any): string {
  const affirmations = [
    "You're doing an amazing job balancing everything. Today, give yourself credit for all the small wins that make a big difference in your family's life.",
    "Every moment you invest in your family matters. Trust yourself, take it one step at a time, and remember that you're exactly the parent your family needs.",
    "Your love and dedication shine through in everything you do. Today, embrace the chaos, celebrate the joy, and know that you're creating beautiful memories.",
    "You are stronger than you know and more capable than you think. Today will bring its challenges, but you have everything you need to handle them with grace.",
    "The care you show for your family is extraordinary. Today, remember to show that same kindness to yourself as you navigate your busy day.",
  ];
  
  const hasEvents = contextData.calendar.length > 0;
  const hasTasks = contextData.tasks.length > 0;
  const hasFamily = contextData.family.length > 0;
  
  if (hasEvents && hasTasks) {
    return "You have a full schedule ahead, but you've handled busy days before and you'll handle this one too. Your ability to manage it all while keeping your family happy is remarkable. Trust yourself today.";
  } else if (hasFamily && contextData.family.length > 1) {
    return `Being there for ${contextData.family.length} family members takes incredible strength and love. You're doing a wonderful job, and your family is lucky to have you. Take pride in all you accomplish today.`;
  }
  
  return affirmations[Math.floor(Math.random() * affirmations.length)];
}
