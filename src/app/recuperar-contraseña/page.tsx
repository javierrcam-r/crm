'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RecuperarContraseñaPage() {
  const router = useRouter();
  const { supabase } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Error de configuración');
      return;
    }

    if (!email) {
      toast.error('Por favor ingresa tu email');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/cambiar-contraseña`,
      });

      if (error) {
        toast.error(error.message || 'Error al enviar el email de recuperación');
        return;
      }

      setEmailSent(true);
      toast.success('Email de recuperación enviado');
    } catch (error: any) {
      console.error('Error en recuperación:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <Card className="p-6 sm:p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Email Enviado
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Hemos enviado un enlace de recuperación a:
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-6 break-all">{email}</p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-xs text-blue-700 dark:text-blue-200">
                Revisa tu bandeja de entrada y haz clic en el enlace para restablecer tu contraseña.
                Si no lo encuentras, revisa tu carpeta de spam.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full">Volver al Login</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            <span className="text-indigo-600 dark:text-indigo-400">Recuperar</span> Contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Ingresa tu email para recibir un enlace de recuperación
          </p>
        </div>

        {/* Card del Formulario */}
        <Card className="p-5 sm:p-8">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 z-10" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-200">
                  Te enviaremos un enlace por email para restablecer tu contraseña.
                  El enlace expirará en 1 hora.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Enviar Enlace de Recuperación
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
