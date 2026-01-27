import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Cliente admin de Supabase (solo para operaciones del servidor)
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin credentials not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// POST - Resetear contraseña de usuario
export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario actual es admin
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario es admin
    const { data: profile } = await supabase
      .from('users_profile')
      .select('rol')
      .eq('user_id', user.id)
      .eq('activo', true)
      .single();

    if (!profile || profile.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, new_password, send_email } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id es requerido' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // Si se envía new_password, establecerla directamente
    if (new_password) {
      if (new_password.length < 6) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 6 caracteres' },
          { status: 400 }
        );
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        user_id,
        {
          password: new_password,
        }
      );

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 }
        );
      }

      // Actualizar password_temp en el perfil para referencia del admin
      await supabase
        .from('users_profile')
        .update({ 
          password_temp: new_password,
          debe_cambiar_password: true 
        })
        .eq('user_id', user_id);

      return NextResponse.json({ 
        message: 'Contraseña actualizada correctamente' 
      }, { status: 200 });
    }

    // Si send_email es true, enviar email de recuperación
    if (send_email) {
      // Obtener el email del usuario
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id);
      
      if (userError || !userData.user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      const { error: inviteError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: userData.user.email || '',
      });

      if (inviteError) {
        return NextResponse.json(
          { error: inviteError.message },
          { status: 400 }
        );
      }

      // Enviar email de recuperación
      const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(
        userData.user.email || ''
      );

      if (emailError) {
        return NextResponse.json(
          { error: emailError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({ 
        message: 'Email de recuperación enviado correctamente' 
      }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Debe proporcionar new_password o send_email' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error reseteando contraseña:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
