'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Bell, Clock, Users, MapPin, Video, Calendar, AlertTriangle, BellRing, AlarmClock, ChevronDown } from 'lucide-react';
import { format, differenceInMinutes, addMinutes, addHours, addDays, setHours, setMinutes, startOfTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Activity } from '@/types/database';
import { notificationService } from '@/lib/notifications';

// Opciones de posponer estilo Google Calendar
export const SNOOZE_OPTIONS: Array<{ value: number | 'tomorrow'; label: string }> = [
  { value: 5, label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 'tomorrow', label: 'Mañana a la misma hora' },
];

interface ReminderNotification {
  id: string;
  activity: Activity;
  timestamp: Date;
  type: 'configured' | 'auto'; // configurado por usuario o automático
  snoozedUntil?: Date; // Si fue pospuesto, cuando volver a mostrar
}

interface ActivityReminderProps {
  activities: Activity[];
  currentUserId?: string; // ID del usuario actual para filtrar recordatorios
  onDismiss?: (activityId: string) => void;
  onView?: (activityId: string) => void;
}

// Recordatorio automático: 30 minutos antes para actividades sin recordatorio configurado
const AUTO_REMINDER_MINUTES = 30;

export default function ActivityReminder({ activities, currentUserId, onDismiss, onView }: ActivityReminderProps) {
  const [notifications, setNotifications] = useState<ReminderNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pushSentIds, setPushSentIds] = useState<Set<string>>(new Set());
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [snoozeDropdownOpen, setSnoozeDropdownOpen] = useState<string | null>(null);
  const [snoozedActivities, setSnoozedActivities] = useState<Map<string, Date>>(new Map());
  const hasChecked = useRef(false);

  // Inicializar servicio de notificaciones
  useEffect(() => {
    notificationService.init();
    
    // Mostrar banner si no tiene permiso y las notificaciones están soportadas
    if (notificationService.isSupported() && notificationService.getPermission() === 'default') {
      setShowPermissionBanner(true);
    }
  }, []);

  // Verificar actividades que necesitan recordatorio
  const checkReminders = useCallback(() => {
    const now = new Date();
    const newNotifications: ReminderNotification[] = [];

    console.log('🔔 Verificando recordatorios...', {
      totalActividades: activities.length,
      hora: now.toLocaleTimeString()
    });

    activities.forEach(activity => {
      // Saltar si ya fue descartada
      if (dismissedIds.has(activity.id)) return;

      // Saltar si está pospuesta y aún no es hora de mostrarla
      const snoozedUntil = snoozedActivities.get(activity.id);
      if (snoozedUntil && snoozedUntil > now) return;

      // Saltar si ya está completada o cancelada
      if (activity.estado === 'realizado' || activity.estado === 'cancelado') return;

      // IMPORTANTE: Solo mostrar recordatorios para actividades del usuario actual
      // El usuario debe ser el creador O ser participante de la actividad
      if (currentUserId) {
        const isCreator = activity.created_by_user_id === currentUserId;
        const isParticipant = Array.isArray(activity.participants) &&
                              activity.participants.some(p => p.user_profile_id === currentUserId);

        if (!isCreator && !isParticipant) {
          return; // No mostrar recordatorio para actividades de otros usuarios
        }
      }

      const activityTime = new Date(activity.fecha_inicio);
      const minutesUntil = differenceInMinutes(activityTime, now);
      
      // Solo actividades futuras (hasta 24 horas)
      if (minutesUntil < 0 || minutesUntil > 1440) return;

      // Verificar que no esté ya en las notificaciones
      const alreadyNotified = notifications.some(n => n.activity.id === activity.id);
      if (alreadyNotified) return;

      // Determinar si debe mostrar recordatorio
      let shouldNotify = false;
      let notificationType: 'configured' | 'auto' = 'auto';

      // Si tiene recordatorio configurado
      if (activity.recordatorio_minutos !== null && activity.recordatorio_minutos !== undefined) {
        const reminderMinutes = activity.recordatorio_minutos;
        // Mostrar si estamos dentro del rango del recordatorio
        if (minutesUntil <= reminderMinutes) {
          shouldNotify = true;
          notificationType = 'configured';
        }
      } else {
        // Recordatorio automático: 30 minutos antes o menos
        if (minutesUntil <= AUTO_REMINDER_MINUTES) {
          shouldNotify = true;
          notificationType = 'auto';
        }
      }

      if (shouldNotify) {
        console.log('🔔 Agregando recordatorio:', {
          titulo: activity.titulo,
          minutosRestantes: minutesUntil,
          tipo: notificationType
        });

        newNotifications.push({
          id: `${activity.id}-${Date.now()}`,
          activity,
          timestamp: now,
          type: notificationType
        });

        // Enviar notificación push si no se ha enviado antes
        if (!pushSentIds.has(activity.id)) {
          sendPushNotification(activity, minutesUntil);
          setPushSentIds(prev => new Set([...prev, activity.id]));
        }
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...prev, ...newNotifications]);
      
      // Reproducir sonido de notificación (si el navegador lo permite)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+fnpuQfG1kYGVueYeLjY2LhoF5cWxqbXN7goiLjIuIhH56dnRzdn2DioqJh4aCfXh0cXJ1e4GGiYmIhoN+eXVycnZ7gYaJiYeEgXx3dHJzdnuBhoiIhoOAfHd0c3R3fIKGiIeFgn57dnRzdXmAhYiIhYKAfHd0c3R3fIGFh4eFgn97d3VzdXh9goaHhYOAfXl2dHR2en+EhoaDgX56dnR0dXl+g4aGg4F+end1dHV4fYKFhYOBfnt4dXR1eH2ChYWDgX57eHZ1dXh9goSEg4F+e3h2dXV4fIGEhIOBfnt4dnZ1eHyBhISCgH57eHZ2dnh8gYODgn9+e3l3dnZ4e4CDg4J/fnx5d3Z2eHuAg4OCf358eXd3dnh7f4KCgn9+fHp4d3d4e3+CgoF/fn17eXh3eHp+gYGBf358e3l4d3l6foGBgX9+fXt6eHh5en6AgYF/fn18enl4eXp9gICAf358e3p5eHl6fYCAgH9+fXx6eXl5enx/gIB/fn18e3p5eXp8f4CAfn59fHt6eXl6fH6AgH9+fXx7enl5ent+f39/fn18e3p5eXp7fn9/f359fHt6enl6e31/f39+fXx8e3p6ent9fn9/fn19fHt7enp7fH5/f359fXx7e3p6e3x+f39+fX18e3t6e3t8fn5/fn19fHx7e3t7fH1+fn59fXx8e3t7e3x9fn5+fX19fHx7e3t8fX5+fn19fHx8e3t7fH1+fn59fX18fHt8fHx9fn5+fX19fHx8fHx8fX5+fn19fXx8fHx8fX1+fn59fX18fHx8fH19fn59fX19fHx8fHx9fX59fX19fXx8fHx8fX1+fX19fX18fHx8fH19fn19fX19fHx8fXx9fX19fX19fXx8fH19fX19fX19fXx8fH19fX19fX19fX18fH19fX19fX19fX19fHx9fX19fX19fX19fXx8fX19fX19fX19fX18fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignorar si no se puede reproducir
      } catch (e) {}
    }
  }, [activities, dismissedIds, notifications, pushSentIds, currentUserId, snoozedActivities]);

  // Función para enviar notificación push
  const sendPushNotification = async (activity: Activity, minutesUntil: number) => {
    const timeText = minutesUntil <= 0 ? '¡Ahora!' : 
                     minutesUntil < 60 ? `En ${minutesUntil} minutos` : 
                     `En ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}min`;

    await notificationService.notify({
      title: `🔔 ${activity.titulo}`,
      body: `${timeText} - ${format(new Date(activity.fecha_inicio), "HH:mm", { locale: es })}`,
      tag: `activity-${activity.id}`,
      url: '/actividades',
      activityId: activity.id
    });
  };

  // Solicitar permiso de notificaciones
  const handleRequestPermission = async () => {
    const permission = await notificationService.requestPermission();
    if (permission === 'granted') {
      setShowPermissionBanner(false);
    }
  };

  // Verificar al cargar y cada 30 segundos
  useEffect(() => {
    // Verificar inmediatamente
    if (!hasChecked.current) {
      hasChecked.current = true;
      setTimeout(checkReminders, 500); // Pequeño delay para asegurar que los datos estén listos
    }
    
    // Verificar cada 30 segundos
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  // Re-verificar cuando cambien las actividades
  useEffect(() => {
    if (activities.length > 0) {
      checkReminders();
    }
  }, [activities.length]);

  const handleDismiss = (notificationId: string, activityId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setDismissedIds(prev => new Set([...prev, activityId]));
    onDismiss?.(activityId);
  };

  const handleView = (activityId: string) => {
    onView?.(activityId);
  };

  const handleSnooze = (notificationId: string, activityId: string, snoozeValue: number | 'tomorrow') => {
    let snoozeUntil: Date;
    const now = new Date();

    if (snoozeValue === 'tomorrow') {
      // Mañana a la misma hora que la actividad
      const activity = notifications.find(n => n.id === notificationId)?.activity;
      if (activity) {
        const activityTime = new Date(activity.fecha_inicio);
        const tomorrow = startOfTomorrow();
        snoozeUntil = setMinutes(setHours(tomorrow, activityTime.getHours()), activityTime.getMinutes());
      } else {
        snoozeUntil = addDays(now, 1);
      }
    } else {
      snoozeUntil = addMinutes(now, snoozeValue);
    }

    // Guardar cuando volver a mostrar
    setSnoozedActivities(prev => new Map(prev).set(activityId, snoozeUntil));

    // Remover de las notificaciones actuales
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setSnoozeDropdownOpen(null);

    console.log('⏰ Actividad pospuesta:', {
      activityId,
      snoozeUntil: snoozeUntil.toLocaleString()
    });
  };

  // Verificar actividades pospuestas que ya deben mostrarse
  useEffect(() => {
    const checkSnoozed = setInterval(() => {
      const now = new Date();
      snoozedActivities.forEach((snoozeUntil, activityId) => {
        if (snoozeUntil <= now) {
          // Remover de pospuestos para que vuelva a aparecer
          setSnoozedActivities(prev => {
            const newMap = new Map(prev);
            newMap.delete(activityId);
            return newMap;
          });
          // Remover de dismissed para que vuelva a verificarse
          setDismissedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(activityId);
            return newSet;
          });
        }
      });
    }, 10000); // Verificar cada 10 segundos

    return () => clearInterval(checkSnoozed);
  }, [snoozedActivities]);

  const getTimeUntilActivity = (fechaInicio: string) => {
    const now = new Date();
    const activityTime = new Date(fechaInicio);
    const diff = activityTime.getTime() - now.getTime();
    
    if (diff < 0) return '¡Ahora!';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes === 0) return '¡En menos de 1 minuto!';
    if (minutes < 60) return `En ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours < 24) {
      return remainingMins > 0 
        ? `En ${hours}h ${remainingMins}min` 
        : `En ${hours} hora${hours > 1 ? 's' : ''}`;
    }
    
    return format(activityTime, "dd MMM 'a las' HH:mm", { locale: es });
  };

  return (
    <>
      {/* Banner para solicitar permisos de notificaciones */}
      {showPermissionBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] pointer-events-auto">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-2xl p-4 text-white">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <BellRing className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Activar notificaciones</h4>
                <p className="text-sm text-white/80 mt-1">
                  Recibe recordatorios de tus actividades incluso cuando no tengas la app abierta
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleRequestPermission}
                    className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium text-sm hover:bg-white/90 transition-colors"
                  >
                    Activar
                  </button>
                  <button
                    onClick={() => setShowPermissionBanner(false)}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowPermissionBanner(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificaciones in-app */}
      {notifications.length > 0 && (
        <div className="fixed right-4 top-20 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {notifications.map((notification, index) => {
        const { activity, type } = notification;
        const participants = activity.participants || [];
        const isUrgent = differenceInMinutes(new Date(activity.fecha_inicio), new Date()) <= 5;
        
        return (
          <div
            key={notification.id}
            className={`pointer-events-auto bg-white rounded-xl shadow-2xl border-2 overflow-hidden transform transition-all duration-500 ${
              isUrgent ? 'border-red-400 animate-pulse' : 'border-purple-300'
            }`}
            style={{ 
              animation: `slideInRight 0.5s ease-out ${index * 100}ms forwards`,
              opacity: 0,
              transform: 'translateX(100%)'
            }}
          >
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${
              isUrgent 
                ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600'
            }`}>
              <div className="flex items-center gap-2 text-white">
                {isUrgent ? (
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                ) : (
                  <Bell className="h-5 w-5 animate-bounce" />
                )}
                <span className="font-semibold">
                  {isUrgent ? '¡Urgente!' : 'Recordatorio'}
                </span>
                {type === 'auto' && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Auto</span>
                )}
              </div>
              <button
                onClick={() => handleDismiss(notification.id, activity.id)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <h4 className="font-bold text-gray-900 text-lg mb-2">{activity.titulo}</h4>
              
              <div className="space-y-2 text-sm">
                {/* Tiempo */}
                <div className={`flex items-center gap-2 font-semibold ${
                  isUrgent ? 'text-red-600' : 'text-purple-600'
                }`}>
                  <Clock className="h-4 w-4" />
                  <span>{getTimeUntilActivity(activity.fecha_inicio)}</span>
                </div>
                
                {/* Fecha completa */}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(activity.fecha_inicio), "EEEE dd 'de' MMMM 'a las' HH:mm", { locale: es })}</span>
                </div>
                
                {/* Ubicación o enlace */}
                {activity.es_virtual && activity.enlace_reunion ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Video className="h-4 w-4" />
                    <a 
                      href={activity.enlace_reunion} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline truncate"
                    >
                      Unirse a la reunión
                    </a>
                  </div>
                ) : activity.ubicacion && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{activity.ubicacion}</span>
                  </div>
                )}
                
                {/* Participantes */}
                {participants.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span className="truncate">
                      {participants.slice(0, 2).map(p => p.user_profile?.nombre_completo?.split(' ')[0]).join(', ')}
                      {participants.length > 2 && ` +${participants.length - 2}`}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleView(activity.id)}
                  className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors ${
                    isUrgent
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  Ver detalles
                </button>

                {/* Botón Posponer con dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setSnoozeDropdownOpen(snoozeDropdownOpen === notification.id ? null : notification.id)}
                    className="px-4 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors flex items-center gap-1"
                  >
                    <AlarmClock className="h-4 w-4" />
                    <span className="hidden sm:inline">Posponer</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {snoozeDropdownOpen === notification.id && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-50">
                      {SNOOZE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => handleSnooze(notification.id, activity.id, option.value)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDismiss(notification.id, activity.id)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      
          <style jsx global>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// Opciones de recordatorio tipo Google Calendar
export const REMINDER_OPTIONS = [
  { value: 0, label: 'En el momento del evento' },
  { value: 5, label: '5 minutos antes' },
  { value: 10, label: '10 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 120, label: '2 horas antes' },
  { value: 1440, label: '1 día antes' },
  { value: 2880, label: '2 días antes' },
  { value: 10080, label: '1 semana antes' },
];
