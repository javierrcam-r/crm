'use client';

import { AlertCircle, Mail } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function SinAccesoPage() {
  const { userProfile, logout } = useAuth();

  const handleLogout = async () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-800 p-4">
      <Card className="max-w-md text-center p-6 sm:p-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/40 mb-4">
          <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-300" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Acceso Pendiente
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Tu cuenta ha sido creada pero aún no tienes un perfil activo en el sistema.
        </p>

        {userProfile?.email && (
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4 break-all">
            Usuario: <strong>{userProfile.email}</strong>
          </p>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-2">
            ¿Qué hacer?
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
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
