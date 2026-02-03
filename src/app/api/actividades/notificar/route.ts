import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Esta API envía correos de recordatorio y notificaciones a los participantes de una actividad
// NOTA: En producción, deberías usar un servicio de correo como SendGrid, Resend, o similar

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activityId, type = 'reminder' } = body; // type: 'reminder' | 'invitation' | 'update'

    if (!activityId) {
      return NextResponse.json({ error: 'Se requiere activityId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener la actividad con sus participantes
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select(`
        *,
        participants:activity_participants(
          *,
          user_profile:users_profile(id, nombre_completo, email)
        ),
        creator:users_profile!activities_created_by_user_id_fkey(nombre_completo, email)
      `)
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
    }

    const participants = activity.participants || [];
    
    if (participants.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay participantes para notificar',
        notified: 0 
      });
    }

    // Preparar los datos del correo
    interface Recipient {
      email: string;
      nombre: string;
    }

    const emailData: {
      activity: typeof activity;
      creator: typeof activity.creator;
      type: string;
      recipients: Recipient[];
    } = {
      activity: {
        titulo: activity.titulo,
        descripcion: activity.descripcion,
        tipo: activity.tipo,
        fecha_inicio: activity.fecha_inicio,
        fecha_fin: activity.fecha_fin,
        ubicacion: activity.ubicacion,
        es_virtual: activity.es_virtual,
        enlace_reunion: activity.enlace_reunion,
        prioridad: activity.prioridad
      },
      creator: activity.creator,
      type,
      recipients: participants
        .filter((p: any) => p.user_profile?.email)
        .map((p: any) => ({
          email: p.user_profile.email,
          nombre: p.user_profile.nombre_completo
        }))
    };

    // En un entorno de producción, aquí enviarías el correo usando un servicio como:
    // - SendGrid: await sendgrid.send(emailData)
    // - Resend: await resend.emails.send(emailData)
    // - Nodemailer con SMTP
    
    // Por ahora, simulamos el envío y registramos en la consola
    console.log('📧 Enviando notificación de actividad:', {
      tipo: type,
      actividad: activity.titulo,
      destinatarios: emailData.recipients.map((r: Recipient) => r.email),
      fecha: new Date().toISOString()
    });

    // Marcar el correo como enviado en la base de datos
    if (type === 'reminder') {
      await supabase
        .from('activities')
        .update({ 
          recordatorio_enviado: true,
          correo_enviado: true 
        })
        .eq('id', activityId);
    } else {
      await supabase
        .from('activities')
        .update({ correo_enviado: true })
        .eq('id', activityId);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Notificación enviada a ${emailData.recipients.length} participante(s)`,
      notified: emailData.recipients.length,
      recipients: emailData.recipients.map(r => r.email)
    });

  } catch (error: any) {
    console.error('Error enviando notificación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al enviar notificación' },
      { status: 500 }
    );
  }
}

// GET: Obtener actividades que necesitan recordatorio
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    // Buscar actividades con recordatorio pendiente
    const { data: activities, error } = await supabase
      .from('activities')
      .select(`
        id,
        titulo,
        fecha_inicio,
        recordatorio_minutos,
        participants:activity_participants(
          user_profile:users_profile(email, nombre_completo)
        )
      `)
      .not('recordatorio_minutos', 'is', null)
      .eq('recordatorio_enviado', false)
      .neq('estado', 'realizado')
      .neq('estado', 'cancelado');

    if (error) {
      throw error;
    }

    // Filtrar actividades que necesitan enviar recordatorio ahora
    const activitiesToNotify = (activities || []).filter((activity: any) => {
      const activityTime = new Date(activity.fecha_inicio);
      const reminderTime = new Date(activityTime.getTime() - activity.recordatorio_minutos * 60 * 1000);
      return now >= reminderTime && now < activityTime;
    });

    return NextResponse.json({
      total: activitiesToNotify.length,
      activities: activitiesToNotify
    });

  } catch (error: any) {
    console.error('Error obteniendo recordatorios:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener recordatorios' },
      { status: 500 }
    );
  }
}
