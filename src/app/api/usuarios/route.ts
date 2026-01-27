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

// POST - Crear nuevo usuario
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
    const { nombre_completo, email, telefono, rol, password } = body;

    if (!nombre_completo || !email || !rol) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Crear usuario en auth.users usando Admin API
    const adminClient = getAdminClient();
    
    // Si se proporciona password, crear usuario con email y password
    // Si no, crear usuario y enviar invitación por email
    let authUser;
    if (password) {
      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Confirmar email automáticamente
      });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      authUser = newUser.user;
    } else {
      // Crear usuario sin password (se enviará invitación)
      const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: false,
      });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      authUser = newUser.user;

      // Enviar invitación por email
      await adminClient.auth.admin.inviteUserByEmail(email);
    }

    if (!authUser) {
      return NextResponse.json(
        { error: 'Error al crear usuario' },
        { status: 500 }
      );
    }

    // Crear perfil del usuario con contraseña temporal
    const { data: userProfile, error: profileError } = await supabase
      .from('users_profile')
      .insert({
        user_id: authUser.id,
        nombre_completo,
        email,
        telefono: telefono || null,
        rol,
        activo: true,
        password_temp: password || null, // Guardar contraseña temporal para referencia del admin
        debe_cambiar_password: true, // El usuario debe cambiar su contraseña
        created_by: user.id,
      })
      .select()
      .single();

    if (profileError) {
      // Si falla la creación del perfil, eliminar el usuario de auth
      await adminClient.auth.admin.deleteUser(authUser.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: userProfile }, { status: 201 });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
