import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EventConfirmation() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const confirmarAsistencia = async () => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/eventos/${id}/confirmar-asistencia`, {
        method: 'POST'
      });
      if (response.ok) {
        setConfirmed(true);
        toast.success("Asistencia confirmada!");
      } else {
        const data = await response.json();
        setError(data.error || 'No se pudo confirmar la asistencia');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg, #f3f4f6)] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-8 text-center ring-1 ring-black/5">
        
        {confirmed ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Completado!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Tu asistencia al evento fue confirmada correctamente.
            </p>
            <Link to="/map" className="inline-flex items-center text-[var(--app-blue)] hover:underline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver al mapa
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirmar Asistencia</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-sm">
              Estás a punto de confirmar tu asistencia a este evento. ¿Deseas continuar?
            </p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center">
                <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-left">{error}</span>
              </div>
            )}

            <button
              onClick={confirmarAsistencia}
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--app-blue, #3b82f6)] hover:bg-opacity-90 text-white font-medium rounded-xl transition-all disabled:opacity-50 flex justify-center items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar Asistencia'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
