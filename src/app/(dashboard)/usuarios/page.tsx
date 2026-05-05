'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Users,
  Phone,
  Mail,
  Shield,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  X,
  Key,
  User,
  Megaphone,
  Wrench,
  ScanLine,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  type UserProfile,
} from '@/lib/services/users';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database';
import toast from 'react-hot-toast';

const getRoleBadge = (rol: UserRole) => {
  const roles: Record<UserRole, { label: string; variant: 'red' | 'blue' | 'green' | 'purple' | 'yellow'; icon: typeof Shield }> = {
    admin: { label: 'Administrador', variant: 'red', icon: Shield },
    vendedor: { label: 'Vendedor', variant: 'blue', icon: Users },
    supervisor: { label: 'Supervisor', variant: 'green', icon: UserCheck },
    supervisor_nivel1: { label: 'Supervisor N1', variant: 'purple', icon: UserCheck },
    supervisor_vendedor: { label: 'Sup. + Vendedor', variant: 'blue', icon: UserCheck },
    vendedor_tecnico: { label: 'Vendedor + Técnico', variant: 'yellow', icon: Wrench },
    marketing: { label: 'Marketing', variant: 'green', icon: Megaphone },
    tecnico: { label: 'Técnico', variant: 'yellow', icon: Wrench },
    event_assistant: { label: 'Asist. Evento', variant: 'purple', icon: ScanLine },
  };
  return roles[rol];
};

export default function UsuariosPage() {
  const { isUserAdmin, userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState<string>('');
  const [filterActivo, setFilterActivo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [passwordOption, setPasswordOption] = useState<'set' | 'email'>('set');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    nombre_completo: '',
    email: '',
    telefono: '',
    password: '',
    rol: 'vendedor' as UserRole,
    activo: true,
  });

  useEffect(() => {
    if (isUserAdmin) {
      loadUsers();
    }
  }, [isUserAdmin]);

  useEffect(() => {
    if (isUserAdmin) {
      const timer = setTimeout(() => {
        loadUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search, filterRol, filterActivo, isUserAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers({
        search: search || undefined,
        rol: filterRol ? (filterRol as UserRole) : undefined,
        activo: filterActivo ? filterActivo === 'true' : undefined,
      });
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username || '',
        nombre_completo: user.nombre_completo,
        email: user.email,
        telefono: user.telefono || '',
        password: '',
        rol: user.rol,
        activo: user.activo,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        nombre_completo: '',
        email: '',
        telefono: '',
        password: '',
        rol: 'vendedor',
        activo: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      username: '',
      nombre_completo: '',
      email: '',
      telefono: '',
      password: '',
      rol: 'vendedor',
      activo: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Actualizar usuario existente
        const updateData: any = {
          username: formData.username,
          nombre_completo: formData.nombre_completo,
          email: formData.email,
          telefono: formData.telefono || null,
          rol: formData.rol,
          activo: formData.activo,
        };
        
        // Solo actualizar password si se proporcionó
        if (formData.password) {
          updateData.password = formData.password;
          updateData.password_temp = formData.password;
          updateData.debe_cambiar_password = true;
        }
        
        await updateUser(editingUser.id, updateData);
        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario directamente en la tabla
        if (!formData.username || !formData.password) {
          toast.error('Usuario y contraseña son requeridos');
          return;
        }
        
        await createUser({
          user_id: crypto.randomUUID(), // Generar un ID único
          username: formData.username,
          nombre_completo: formData.nombre_completo,
          email: formData.email,
          telefono: formData.telefono || null,
          password: formData.password,
          password_temp: formData.password,
          debe_cambiar_password: true,
          rol: formData.rol,
          activo: true,
        });

        toast.success('Usuario creado correctamente');
      }
      handleCloseModal();
      loadUsers();
    } catch (error: any) {
      console.error('Error guardando usuario:', error);
      toast.error(error.message || 'Error al guardar usuario');
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      if (user.activo) {
        await deleteUser(user.id);
        toast.success('Usuario desactivado');
      } else {
        await activateUser(user.id);
        toast.success('Usuario activado');
      }
      loadUsers();
    } catch (error: any) {
      console.error('Error cambiando estado:', error);
      toast.error(error.message || 'Error al cambiar estado del usuario');
    }
  };

  const handleOpenPasswordModal = (user: UserProfile) => {
    setResettingUser(user);
    setPasswordOption('set');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setResettingUser(null);
    setPasswordOption('set');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    try {
      if (passwordOption === 'set') {
        // Validar contraseña
        if (newPassword.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          return;
        }

        if (newPassword !== confirmPassword) {
          toast.error('Las contraseñas no coinciden');
          return;
        }

        // Establecer nueva contraseña
        const response = await fetch('/api/usuarios/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: resettingUser.user_id,
            new_password: newPassword,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al resetear contraseña');
        }

        toast.success('Contraseña actualizada correctamente');
      } else {
        // Enviar email de recuperación
        const response = await fetch('/api/usuarios/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: resettingUser.user_id,
            send_email: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al enviar email');
        }

        toast.success('Email de recuperación enviado correctamente');
      }

      handleClosePasswordModal();
    } catch (error: any) {
      console.error('Error reseteando contraseña:', error);
      toast.error(error.message || 'Error al resetear contraseña');
    }
  };

  // Si no es admin, mostrar mensaje de acceso denegado
  if (!isUserAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md text-center">
          <Shield className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Solo los administradores pueden gestionar usuarios.
          </p>
        </Card>
      </div>
    );
  }

  const filteredUsers = users;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
            Gestiona los usuarios y sus roles en el sistema
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="vendedor">Vendedor</option>
              <option value="supervisor">Supervisor</option>
              <option value="supervisor_nivel1">Supervisor N1</option>
              <option value="supervisor_vendedor">Sup. + Vendedor</option>
              <option value="vendedor_tecnico">Vendedor + Técnico</option>
              <option value="marketing">Marketing</option>
              <option value="tecnico">Técnico</option>
              <option value="event_assistant">Asist. Evento</option>
            </Select>
            <Select
              value={filterActivo}
              onChange={(e) => setFilterActivo(e.target.value)}
              className="w-full sm:w-32"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Lista de usuarios */}
      {loading ? (
        <Card>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando usuarios...</p>
          </div>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay usuarios"
          description="Comienza agregando un nuevo usuario al sistema"
        />
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const roleInfo = getRoleBadge(user.rol);
            const RoleIcon = roleInfo.icon;
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {user.nombre_completo}
                      </h3>
                      <Badge variant={roleInfo.variant} className="flex items-center gap-1 whitespace-nowrap">
                        <RoleIcon className="h-3 w-3" />
                        {roleInfo.label}
                      </Badge>
                      {!user.activo && (
                        <Badge variant="gray">Inactivo</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      {user.username && (
                        <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                          <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-mono text-indigo-700 dark:text-indigo-300">{user.username}</span>
                        </div>
                      )}
                      {user.email && (
                        <div className="flex items-center gap-1.5 break-all">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          {user.email}
                        </div>
                      )}
                      {user.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4" />
                          {user.telefono}
                        </div>
                      )}
                      {user.password_temp && (
                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                          <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-amber-800 dark:text-amber-200 font-mono">
                            {user.password_temp}
                          </span>
                          <span className="text-xs text-amber-600 dark:text-amber-400">(temporal)</span>
                        </div>
                      )}
                    </div>
                    {user.debe_cambiar_password && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        ⚠️ Este usuario debe cambiar su contraseña al iniciar sesión
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 lg:flex-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenModal(user)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenPasswordModal(user)}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <Key className="h-4 w-4" />
                      <span className="hidden sm:inline">Contraseña</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                      className={cn(
                        'flex items-center gap-1',
                        user.activo
                          ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                          : 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                      )}
                    >
                      {user.activo ? (
                        <>
                          <UserX className="h-4 w-4" />
                          <span className="hidden sm:inline">Desactivar</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" />
                          <span className="hidden sm:inline">Activar</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de crear/editar */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Usuario *
            </label>
            <Input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              required
              placeholder="cfernandez"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nombre de usuario para iniciar sesión (sin espacios)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Contraseña {!editingUser && '*'}
            </label>
            <Input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
              placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Contraseña temporal'}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {editingUser ? 'Deja vacío si no quieres cambiar la contraseña' : 'Contraseña temporal que el usuario usará para entrar'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Nombre Completo *
            </label>
            <Input
              type="text"
              value={formData.nombre_completo}
              onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="usuario@ejemplo.com (opcional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Teléfono
            </label>
            <Input
              type="tel"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Rol *
            </label>
            <Select
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole })}
              required
            >
              <option value="vendedor">Vendedor</option>
              <option value="supervisor">Supervisor</option>
              <option value="supervisor_nivel1">Supervisor Nivel 1</option>
              <option value="supervisor_vendedor">Supervisor + Vendedor</option>
              <option value="vendedor_tecnico">Vendedor + Técnico</option>
              <option value="marketing">Marketing</option>
              <option value="tecnico">Técnico</option>
              <option value="event_assistant">Asist. Evento</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="rounded border-gray-300 dark:border-dark-500 dark:bg-dark-600 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="activo" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Usuario activo
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Resetear Contraseña */}
      <Modal
        isOpen={showPasswordModal}
        onClose={handleClosePasswordModal}
        title="Resetear Contraseña"
      >
        {resettingUser && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Usuario: <span className="font-medium text-gray-900 dark:text-white">{resettingUser.nombre_completo}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 break-all">
                Email: <span className="font-medium text-gray-900 dark:text-white">{resettingUser.email}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="passwordOption"
                    value="set"
                    checked={passwordOption === 'set'}
                    onChange={() => setPasswordOption('set')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Establecer nueva contraseña</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="passwordOption"
                    value="email"
                    checked={passwordOption === 'email'}
                    onChange={() => setPasswordOption('email')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Enviar email de recuperación</span>
                </label>
              </div>
            </div>

            {passwordOption === 'set' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Nueva Contraseña *
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required={passwordOption === 'set'}
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Confirmar Contraseña *
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    required={passwordOption === 'set'}
                    minLength={6}
                  />
                </div>
              </>
            )}

            {passwordOption === 'email' && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Se enviará un email a <strong>{resettingUser.email}</strong> con un enlace para que el usuario pueda restablecer su contraseña.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={handleClosePasswordModal}>
                Cancelar
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                {passwordOption === 'set' ? 'Establecer Contraseña' : 'Enviar Email'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
