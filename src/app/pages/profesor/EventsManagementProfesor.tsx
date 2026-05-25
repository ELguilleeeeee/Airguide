import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Building2, Search, QrCode } from 'lucide-react';
import { useEdificios } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'https://airguidebackend-production.up.railway.app/api';

export interface Evento {
  id_evento: number;
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  id_edificio: number;
  publico: boolean;
  activo: boolean;
  id_creador?: number;
  prioridad_evento?: number;
  total_invitados?: number;
  asistentes_confirmados?: number;
  edificio?: {
    id_edificio: number;
    nombre: string;
    tipo: string;
    latitud: number;
    longitud: number;
  };
}

export default function EventsManagementProfesor() {
  const { edificios } = useEdificios();
  const { user } = useAuth();
  
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrEvento, setQrEvento] = useState<Evento | null>(null);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [deletingEvento, setDeletingEvento] = useState<Evento | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    id_edificio: '',
    total_invitados: 0,
    publico: true,
    activo: true
  });

  const formatDatetimeForInput = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    } catch { 
      return ''; 
    }
  };

  // Fetch events
  const fetchEventos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No autorizado');

      const response = await fetch(`${API_URL}/docentes/eventos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al cargar eventos');
      const data = await response.json();
      setEventos(data);
    } catch (err: any) {
      toast.error(err.message || 'Error al obtener eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventosFiltrados = eventos.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No autorizado');

      const payload = {
        ...formData,
        id_edificio: parseInt(formData.id_edificio),
        total_invitados: parseInt(formData.total_invitados.toString()) || 0
      };

      let response;
      if (editingEvento) {
        response = await fetch(`${API_URL}/docentes/eventos/${editingEvento.id_evento}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_URL}/docentes/eventos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al guardar evento');
      }

      if (result.warning) {
        toast.info(result.warning, { duration: 6000 });
      } else {
        toast.success(editingEvento ? 'Evento actualizado correctamente' : 'Evento creado correctamente');
      }

      setShowModal(false);
      resetForm();
      fetchEventos();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar evento');
    }
  };

  const handleEdit = (evento: Evento) => {
    setEditingEvento(evento);
    setFormData({
      nombre: evento.nombre,
      descripcion: evento.descripcion || '',
      fecha_inicio: formatDatetimeForInput(evento.fecha_inicio),
      fecha_fin: formatDatetimeForInput(evento.fecha_fin),
      id_edificio: evento.id_edificio.toString(),
      total_invitados: evento.total_invitados || 0,
      publico: evento.publico,
      activo: evento.activo
    });
    setShowModal(true);
  };

  const handleDeleteClick = (evento: Evento) => {
    setDeletingEvento(evento);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvento) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No autorizado');

      const response = await fetch(`${API_URL}/docentes/eventos/${deletingEvento.id_evento}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar evento');
      }

      toast.success('Evento eliminado correctamente');
      setShowDeleteModal(false);
      setDeletingEvento(null);
      fetchEventos();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar evento');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      fecha_inicio: '',
      fecha_fin: '',
      id_edificio: '',
      total_invitados: 0,
      publico: true,
      activo: true
    });
    setEditingEvento(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const isEventoActivo = (evento: Evento) => {
    const now = new Date();
    const inicio = new Date(evento.fecha_inicio);
    const fin = new Date(evento.fecha_fin);
    return now >= inicio && now <= fin && evento.activo;
  };

  const isEventoProximo = (evento: Evento) => {
    const now = new Date();
    const inicio = new Date(evento.fecha_inicio);
    return inicio > now && evento.activo;
  };

  return (
    <div className='min-h-screen bg-[var(--app-background)] p-6 space-y-6'>
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-[var(--app-text-primary)]">
            Mis Eventos
          </h2>
          <p className="text-sm text-[var(--app-text-secondary)] mt-1">
            Administra tus conferencias, reuniones y asesorías académicas
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[var(--app-blue)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity shadow-md cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Nuevo Evento
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--app-text-secondary)]" />
        <input
          type="text"
          placeholder="Buscar eventos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--app-hover)] border-b border-[var(--app-border)]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
                Ubicación
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
                Fechas
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-[var(--app-blue)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-[var(--app-text-secondary)] font-medium">Cargando eventos...</span>
                  </div>
                </td>
              </tr>
            ) : eventosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-[var(--app-text-secondary)]">
                  No se encontraron eventos agendados
                </td>
              </tr>
            ) : (
              eventosFiltrados.map((evento) => {
                const isOwner = user && evento.id_creador === user.id;
                return (
                  <tr key={evento.id_evento} className="hover:bg-[var(--app-hover)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--app-blue-light)] text-[var(--app-blue)]">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text-primary)]">
                            {evento.nombre}
                          </div>
                          {evento.descripcion && (
                            <div className="text-xs text-[var(--app-text-secondary)] line-clamp-1 mt-0.5">
                              {evento.descripcion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--app-blue)]" />
                        <span className="text-sm text-[var(--app-text-primary)]">
                          {evento.edificio?.nombre || 'Sin edificio'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--app-text-primary)] font-medium">
                        {new Date(evento.fecha_inicio).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-[var(--app-text-secondary)] mt-0.5">
                        hasta {new Date(evento.fecha_fin).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {isEventoActivo(evento) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 w-fit">
                            En curso
                          </span>
                        ) : isEventoProximo(evento) ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 w-fit">
                            Próximo
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-fit">
                            Finalizado
                          </span>
                        )}
                      </div>
                      {evento.total_invitados && evento.total_invitados > 0 ? (
                        <div className="text-xs text-[var(--app-text-secondary)] mt-1 font-medium">
                          {evento.asistentes_confirmados || 0} / {evento.total_invitados} confirmados
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        {isOwner && (
                          <button
                            onClick={() => { setQrEvento(evento); setShowQrModal(true); }}
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-lg transition-colors"
                            title="Generar QR de Check-in"
                          >
                            <QrCode className="w-4.5 h-4.5" />
                          </button>
                        )}
                        {isOwner ? (
                          <>
                            <button
                              onClick={() => handleEdit(evento)}
                              className="p-2 text-[var(--app-blue)] hover:bg-[var(--app-blue-light)] rounded-lg transition-colors"
                              title="Editar Evento"
                            >
                              <Edit className="w-4.5 h-4.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(evento)}
                              className="p-2 text-red-500 hover:bg-red-500/15 rounded-lg transition-colors"
                              title="Eliminar Evento"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-[var(--app-text-secondary)] italic mr-2 select-none">
                            Solo lectura
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--app-card-bg)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--app-border)]">
            <div className="p-6 border-b border-[var(--app-border)]">
              <h3 className="text-xl font-bold text-[var(--app-text-primary)]">
                {editingEvento ? 'Editar Evento' : 'Nuevo Evento'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                  Nombre del Evento *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                  placeholder="Ej: Asesoría de Programación"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                  rows={3}
                  placeholder="Describe brevemente de qué tratará el evento"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                  Edificio *
                </label>
                <select
                  required
                  value={formData.id_edificio}
                  onChange={(e) => setFormData({ ...formData, id_edificio: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                >
                  <option value="">Selecciona un edificio...</option>
                  {edificios.map((edificio) => (
                    <option key={edificio.id_edificio} value={edificio.id_edificio}>
                      {edificio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                    Organizador
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${user?.nombre} (Fijo)`}
                    className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-secondary)] opacity-70 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                    Prioridad del Evento
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Prioridad 3 (Fijo)"
                    className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-secondary)] opacity-70 cursor-not-allowed text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                  Total de Invitados (0 = Sin límite)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.total_invitados}
                  onChange={(e) => setFormData({ ...formData, total_invitados: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--app-text-primary)] mb-1">
                    Fecha de Fin *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.fecha_fin}
                    onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--app-hover)] border border-[var(--app-border)] rounded-lg text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-blue)] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="publico"
                    checked={formData.publico}
                    onChange={(e) => setFormData({ ...formData, publico: e.target.checked })}
                    className="w-4 h-4 text-[var(--app-blue)] rounded focus:ring-[var(--app-blue)]"
                  />
                  <label htmlFor="publico" className="text-sm font-medium text-[var(--app-text-primary)]">
                    Evento público
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-[var(--app-blue)] rounded focus:ring-[var(--app-blue)]"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-[var(--app-text-primary)]">
                    Evento activo
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] rounded-lg hover:bg-opacity-80 transition-all font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[var(--app-blue)] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-md cursor-pointer"
                >
                  {editingEvento ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {showDeleteModal && deletingEvento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--app-card-bg)] rounded-xl shadow-xl max-w-md w-full p-6 border border-[var(--app-border)]">
            <h3 className="text-xl font-bold text-[var(--app-text-primary)] mb-2">
              Eliminar Evento
            </h3>
            <p className="text-sm text-[var(--app-text-secondary)] mb-6">
              ¿Estás seguro de que deseas eliminar el evento <strong>"{deletingEvento.nombre}"</strong>? Esta acción es irreversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingEvento(null);
                }}
                className="flex-1 px-4 py-2 bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] rounded-lg hover:bg-opacity-80 transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-md cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {showQrModal && qrEvento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--app-card-bg)] rounded-xl shadow-xl max-w-sm w-full p-6 text-center border border-[var(--app-border)]">
            <h3 className="text-lg font-bold text-[var(--app-text-primary)] mb-2">
              QR de Asistencia
            </h3>
            <p className="text-sm text-[var(--app-text-secondary)] mb-6 truncate">
              {qrEvento.nombre}
            </p>
            <div className="bg-white p-4 rounded-xl inline-block shadow-sm">
              <QRCodeSVG 
                value={`${window.location.origin}/eventos/${qrEvento.id_evento}/confirmar`}
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
              />
            </div>
            <div className="mt-6">
              <button
                onClick={() => { setShowQrModal(false); setQrEvento(null); }}
                className="px-4 py-2 bg-[var(--app-hover)] text-[var(--app-text-primary)] border border-[var(--app-border)] rounded-lg hover:bg-opacity-80 transition-all w-full font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
