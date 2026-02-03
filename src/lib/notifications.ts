// Sistema de notificaciones push para móviles y desktop
// Funciona en Chrome, Firefox, Safari (iOS 16.4+), Edge

export interface NotificationData {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  activityId?: string;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private swRegistration: ServiceWorkerRegistration | null = null;

  // Verificar si las notificaciones están soportadas
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  // Obtener el estado actual del permiso
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // Solicitar permiso al usuario
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn('Notificaciones no soportadas en este navegador');
      return 'denied';
    }

    try {
      this.permission = await Notification.requestPermission();
      console.log('🔔 Permiso de notificaciones:', this.permission);
      
      if (this.permission === 'granted') {
        await this.registerServiceWorker();
      }
      
      return this.permission;
    } catch (error) {
      console.error('Error solicitando permiso:', error);
      return 'denied';
    }
  }

  // Registrar el Service Worker
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker no soportado');
      return null;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('🔔 Service Worker registrado:', this.swRegistration);
      return this.swRegistration;
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
      return null;
    }
  }

  // Enviar una notificación
  async notify(data: NotificationData): Promise<boolean> {
    // Si no hay permiso, intentar solicitarlo
    if (this.getPermission() !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.log('🔔 Permiso denegado, no se puede enviar notificación');
        return false;
      }
    }

    try {
      // Intentar usar Service Worker primero (funciona en segundo plano)
      if (this.swRegistration) {
        await this.swRegistration.showNotification(data.title, {
          body: data.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: data.tag || 'activity-reminder',
          requireInteraction: true,
          data: {
            url: data.url || '/actividades',
            activityId: data.activityId
          }
        } as NotificationOptions);
        console.log('🔔 Notificación enviada via Service Worker');
        return true;
      }

      // Fallback: usar Notification API directamente
      const notification = new Notification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        tag: data.tag || 'activity-reminder',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        if (data.url) {
          window.location.href = data.url;
        }
        notification.close();
      };

      console.log('🔔 Notificación enviada via Notification API');
      return true;
    } catch (error) {
      console.error('Error enviando notificación:', error);
      return false;
    }
  }

  // Inicializar el servicio
  async init(): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Sistema de notificaciones no disponible');
      return;
    }

    // Registrar Service Worker si hay permiso
    if (this.getPermission() === 'granted') {
      await this.registerServiceWorker();
    }
  }
}

// Singleton
export const notificationService = new NotificationService();

// Hook para usar en componentes React
export function useNotifications() {
  const isSupported = notificationService.isSupported();
  const permission = notificationService.getPermission();

  const requestPermission = async () => {
    return await notificationService.requestPermission();
  };

  const sendNotification = async (data: NotificationData) => {
    return await notificationService.notify(data);
  };

  const init = async () => {
    await notificationService.init();
  };

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    init
  };
}
