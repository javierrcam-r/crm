'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, User, Phone, MessageSquare, ArrowLeft, CheckCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SolicitarAccesoPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    mensaje: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Crear el enlace mailto con todos los datos
      const subject = encodeURIComponent('Solicitud de Acceso al CRM');
      const body = encodeURIComponent(
        `Hola,\n\nSolicito acceso al sistema CRM.\n\n` +
        `Datos del solicitante:\n` +
        `- Nombre: ${formData.nombre}\n` +
        `- Email: ${formData.email}\n` +
        `- Teléfono: ${formData.telefono || 'No proporcionado'}\n\n` +
        `Mensaje:\n${formData.mensaje || 'Sin mensaje adicional'}\n\n` +
        `Saludos,\n${formData.nombre}`
      );

      const mailtoLink = `mailto:javierrcam@gmail.com?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;

      // Simular éxito después de un breve delay
      setTimeout(() => {
        setSubmitted(true);
        toast.success('Redirigiendo a tu cliente de correo...');
      }, 500);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <Card className="p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Solicitud Enviada
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Tu solicitud de acceso ha sido enviada al administrador.
              Te contactaremos pronto.
            </p>
            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full">Volver al Login</Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSubmitted(false)}
              >
                Enviar otra solicitud
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            <span className="text-indigo-600">Solicitar</span> Acceso
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Completa el formulario para solicitar acceso al sistema
          </p>
        </div>

        {/* Card del Formulario */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Tu nombre completo"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tu@email.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+1234567890"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje (Opcional)
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea
                  value={formData.mensaje}
                  onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                  placeholder="Cuéntanos por qué necesitas acceso al sistema..."
                  rows={4}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700">
                <strong>Nota:</strong> Al enviar este formulario, se abrirá tu cliente de correo
                con un mensaje prellenado dirigido al administrador. El administrador revisará
                tu solicitud y te contactará para crear tu cuenta.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/login" className="flex-1">
                <Button type="button" variant="ghost" className="w-full flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar Solicitud
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Información adicional */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
