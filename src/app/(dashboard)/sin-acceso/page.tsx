'use client';

import { AlertCircle, Mail } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function SinAccesoPage() {
  const { user, supabase } = useAuth();

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md text-center p-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Acceso Pendiente
        </h2>
        
        <p className="text-sm text-gray-600 mb-4">
          Tu cuenta ha sido creada pero aún no tienes un perfil activo en el sistema.
        </p>
        
        {user?.email && (
          <p className="text-sm text-gray-700 mb-4">
            Usuario: <strong>{user.email}</strong>
          </p>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 font-medium mb-2">
            ¿Qué hacer?
          </p>
          <p className="text-xs text-blue-700">
            Por favor contacta al administrador para que active tu cuenta y asigne tu rol en el sistema.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:javierrcam@gmail.com?subject=Solicitud de Activación de Cuenta CRM"
            className="w-full"
          >
            <Button className="w-full flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              Contactar Administrador
            </Button>
          </a>
          
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full"
          >
            Cerrar Sesión
          </Button>
        </div>
      </Card>
    </div>
  );
}
