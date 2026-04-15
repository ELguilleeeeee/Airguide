import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Building2, Route as RouteIcon, X, LocateFixed, Eye } from 'lucide-react';
import logoUTEQ from '../../styles/images/letras_uteq_azul2025.png';
import { useEdificios, useEventos, useProfesores } from '../hooks';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { SearchBar } from '../components/SearchBar';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { toast } from 'sonner';

const center = { lat: 20.656333, lng: -100.404745 };
const containerStyle = { width: '100%', height: '100%' };

// --- Iconos de Edificios ---
const getIcon = (color: string, stroke: string) => {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
        <path fill="${color}" stroke="${stroke}" stroke-width="2" d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
};

export default function Map() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { edificios } = useEdificios();
    useEventos();
    const { profesores } = useProfesores();

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyBCORaDyk1go3cDfKQNSM9-CS8wv12GSJM"
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const watchIdRef = useRef<number | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMarker, setSelectedMarker] = useState<any>(null);
    const [routeOrigin, setRouteOrigin] = useState<number | 'user' | null>(null);
    const [routeDestination, setRouteDestination] = useState<number | null>(null);
    const [showRoutePanel, setShowRoutePanel] = useState(false);
    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
    const [autoStitchLines, setAutoStitchLines] = useState<{
        startLine: google.maps.LatLngLiteral[] | null;
        endLine: google.maps.LatLngLiteral[] | null;
    }>({ startLine: null, endLine: null });
    const [customRouteDetails, setCustomRouteDetails] = useState<google.maps.LatLngLiteral[] | null>(null);
    const [isCongested, setIsCongested] = useState(false);

    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapRoutes, setHeatmapRoutes] = useState<Array<{ path: google.maps.LatLngLiteral[], score: number }>>([]);

    // LÓGICA DE GEOLOCALIZACIÓN
    useEffect(() => {
        if (!navigator.geolocation) return;
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude });
            },
            (err) => console.error("Error GPS:", err),
            { enableHighAccuracy: true }
        );
        return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
    }, []);

    const centerOnUser = () => {
        if (map && userLocation) {
            map.panTo(userLocation);
            map.setZoom(18);
        }
    };

    const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    const toggleHeatmap = async () => {
        if (!showHeatmap) {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'https://airguidebackend-production.up.railway.app/api';
                toast.info("Analizando datos de todas las rutas...", { duration: 3000 });
                const res = await fetch(`${API_URL}/rutas/heatmap`);
                if (res.ok) {
                    const data = await res.json();
                    setHeatmapRoutes(data);
                    setShowHeatmap(true);
                } else {
                    toast.error("Error al obtener capa térmica");
                }
            } catch {
                toast.error("Error de conexion al Heatmap AI");
            }
        } else {
            setShowHeatmap(false);
            setHeatmapRoutes([]);
        }
    };

    // FILTROS
    const canViewProfesores = user && ['alumno', 'admin', 'rector'].includes(user.rol);
    const profesoresFiltrados = canViewProfesores ? profesores.filter(p =>
        p.usuario?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.departamento?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const edificiosFiltrados = edificios.filter(e => {
        const matchesEdificio = e.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const hasMatchingProfesor = profesoresFiltrados.some(p =>
            p.cubiculos?.some(c => c.id_edificio === e.id_edificio)
        );
        return matchesEdificio || (searchTerm !== '' && hasMatchingProfesor);
    });

    // CÁLCULO DE RUTA
    const calculateRoute = async () => {
        if (!routeOrigin || !routeDestination) {
            toast.error("Por favor selecciona un origen y un destino.");
            return;
        }

        let originCoords: google.maps.LatLngLiteral;

        if (routeOrigin === 'user') {
            if (!userLocation) {
                toast.error("Esperando señal GPS... asegúrate de dar permisos de ubicación.");
                return;
            }
            originCoords = userLocation;
        } else {
            const originB = edificios.find(e => e.id_edificio === routeOrigin);
            if (!originB) return;
            originCoords = { lat: Number(originB.latitud), lng: Number(originB.longitud) };
        }

        const destB = edificios.find(e => e.id_edificio === routeDestination);
        if (!destB) return;
        const destinationCoords = { lat: Number(destB.latitud), lng: Number(destB.longitud) };

        // FETCH CUSTOM MANUAL ROUTE SEGMENT (IF ANY)
        const API_URL = import.meta.env.VITE_API_URL || 'https://airguidebackend-production.up.railway.app/api';
        const token = localStorage.getItem('token');
        let customPath: google.maps.LatLngLiteral[] | null = null;
        
        if (routeOrigin !== 'user') {
            try {
                const res = await fetch(`${API_URL}/rutas/find`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        origen_tipo: 'edificio',
                        origen_id: routeOrigin.toString(),
                        destino_tipo: 'edificio',
                        destino_id: routeDestination.toString()
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.detalles && data.detalles.length > 0) {
                        customPath = data.detalles.map((d: any) => ({ lat: Number(d.latitud), lng: Number(d.longitud) }));
                        setCustomRouteDetails(customPath);

                        try {
                            const aiRes = await fetch(`${API_URL}/rutas/check-congestion`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id_ruta: data.id_ruta })
                            });
                            if (aiRes.ok) {
                                const aiData = await aiRes.json();

                                if (aiData.congested) {
                                    toast.error(`Alto Flujo Detectado (Riesgo ${(aiData.score * 100).toFixed(0)}%). Sugerimos tomar vías alternas si tiene prisa.`, { duration: 8000 });
                                    setIsCongested(true);
                                } else {
                                    setIsCongested(false);
                                }
                            }
                        } catch (e) {
                            console.error('Error al verificar congestión', e);
                        }

                    } else {
                        setCustomRouteDetails(null);
                        setIsCongested(false);
                    }
                } else {
                    setCustomRouteDetails(null);
                    setIsCongested(false);
                }
            } catch (err) {
                setCustomRouteDetails(null);
                setIsCongested(false);
            }
        } else {
            setCustomRouteDetails(null);
            setIsCongested(false);
        }

        if (!window.google) return;
        const directionsService = new window.google.maps.DirectionsService();

        let googleOrigin = originCoords;
        let googleDestination = destinationCoords;
        let isCustomPathAtOrigin = false;

        if (customPath && customPath.length > 0) {
            // Se calcula si el customPath comienza más cerca del Origen o del Destino
            const distToOrigin = Math.pow(customPath[0].lat - originCoords.lat, 2) + Math.pow(customPath[0].lng - originCoords.lng, 2);
            const distToDest = Math.pow(customPath[customPath.length - 1].lat - destinationCoords.lat, 2) + Math.pow(customPath[customPath.length - 1].lng - destinationCoords.lng, 2);

            if (distToOrigin < distToDest) {
                isCustomPathAtOrigin = true;
                googleOrigin = customPath[customPath.length - 1]; // Iniciar en el final de nuestro tramo manual hacia afuera
            } else {
                googleDestination = customPath[0]; // Terminar en el inicio de nuestro tramo manual interno
            }
        }

        directionsService.route(
            {
                origin: googleOrigin,
                destination: googleDestination,
                travelMode: window.google.maps.TravelMode.WALKING
            },
            (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK && result) {
                    setDirectionsResponse(result);
                    const leg = result.routes[0].legs[0];
                    setRouteInfo({ duration: leg.duration?.text || '', distance: leg.distance?.text || '' });
                    
                    // AUTO-STITCH LAST MILE GAPS
                    setAutoStitchLines({
                        startLine: isCustomPathAtOrigin ? null : [
                            originCoords,
                            { lat: leg.start_location.lat(), lng: leg.start_location.lng() }
                        ],
                        endLine: (!isCustomPathAtOrigin && customPath) ? null : [
                            { lat: leg.end_location.lat(), lng: leg.end_location.lng() },
                            destinationCoords
                        ]
                    });

                    setShowRoutePanel(false);
                } else {
                    toast.error("Google Maps no encontró una ruta peatonal válida entre estos puntos.");
                }
            }
        );
    };

    const clearRoute = () => {
        setDirectionsResponse(null);
        setAutoStitchLines({ startLine: null, endLine: null });
        setCustomRouteDetails(null);
        setIsCongested(false);
        setRouteInfo(null);
        setRouteOrigin(null);
        setRouteDestination(null);
        setShowHeatmap(false);
        setHeatmapRoutes([]);
    };

    if (loadError) return <div className="h-screen flex items-center justify-center">Error cargando Google Maps</div>;

    return (
        <div className="h-screen flex flex-col">
            <header className="bg-[var(--app-header-bg)] border-b border-[var(--app-border)] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={logoUTEQ} alt="Logo UTEQ" className="h-8" />
                    <h1 className="text-xl font-semibold text-[var(--app-text-primary)]">AirGuide</h1>
                </div>
                <div className="flex items-center gap-3">
                    {user?.rol === "alumno" && (
                        <div className="flex items-center gap-4 px-3 py-2 bg-[var(--app-hover)] rounded-lg">
                            <span className="text-sm text-[var(--app-text-primary)]">{user.nombre}</span>
                            <button onClick={() => { logout(); navigate('/login'); }} className="bg-[var(--app-blue)] text-white px-3 py-1 rounded-lg text-sm">Cerrar Sesión</button>
                        </div>
                    )}
                    {user?.rol === "admin" ? (
                        <div className="flex items-center gap-4 px-3 py-2 bg-[var(--app-hover)] rounded-lg">
                            <span className="text-sm text-[var(--app-text-primary)]">{user.nombre}</span>
                            <button onClick={() => { navigate('/admin'); }} className="bg-[var(--app-blue)] text-white px-3 py-1 rounded-lg text-sm">Dashboard</button>
                            <button onClick={() => { logout(); navigate('/login'); }} className="bg-[var(--app-blue)] text-white px-3 py-1 rounded-lg text-sm">Cerrar Sesión</button>
                        </div>
                    ) : (
                        <button onClick={() => navigate('/login')} className="bg-[var(--app-blue)] text-white px-4 py-2 rounded-lg text-sm">Iniciar Sesión</button>
                    )}
                    <ThemeToggle />
                </div>
            </header>

            <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                profesoresFiltrados={profesoresFiltrados}
                canViewProfesores={!!canViewProfesores}
                onProfesorSelect={(p, cubiculo) => {
                    const ed = cubiculo.edificio;
                    if (ed && map) {
                        map.panTo({ lat: Number(ed.latitud), lng: Number(ed.longitud) });
                        map.setZoom(18);
                        setSelectedMarker({
                            ...ed,
                            type: 'profesor',
                            profesorNombre: p.usuario?.nombre,
                            departamento: p.departamento,
                            cubiculoInfo: `Cubículo ${cubiculo.numero}, Piso ${cubiculo.piso}`
                        });
                    }
                }}
            />

            <div className="flex-1 relative">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={15}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{ mapTypeControl: false, streetViewControl: false }}
                    >
                        {userLocation && (
                            <Marker
                                position={userLocation}
                                icon={{
                                    path: window.google.maps.SymbolPath.CIRCLE,
                                    scale: 9,
                                    fillColor: "#3B82F6",
                                    fillOpacity: 0.8,
                                    strokeColor: "white",
                                    strokeWeight: 2,
                                }}
                                title="Tu ubicación actual"
                            />
                        )}

                        {edificiosFiltrados.map((edificio) => (
                            <Marker
                                key={edificio.id_edificio}
                                position={{ lat: Number(edificio.latitud), lng: Number(edificio.longitud) }}
                                icon={{
                                    url: getIcon('#3B82F6', '#1E40AF'),
                                    scaledSize: new window.google.maps.Size(30, 40),
                                    anchor: new window.google.maps.Point(10, 35),
                                }}
                                onClick={() => {
                                    if (map) map.panTo({ lat: Number(edificio.latitud), lng: Number(edificio.longitud) });
                                    setSelectedMarker({ ...edificio, type: 'edificio' });
                                }}
                            />
                        ))}

                        {directionsResponse && (
                            <DirectionsRenderer
                                options={{
                                    directions: directionsResponse,
                                    polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 6, strokeOpacity: 0.8 },
                                    suppressMarkers: true
                                }}
                            />
                        )}

                        {autoStitchLines.startLine && (
                            <Polyline
                                path={autoStitchLines.startLine}
                                options={{
                                    strokeColor: '#3B82F6',
                                    strokeOpacity: 0,
                                    strokeWeight: 4,
                                    icons: [{
                                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                        )}

                        {autoStitchLines.endLine && (
                            <Polyline
                                path={autoStitchLines.endLine}
                                options={{
                                    strokeColor: '#3B82F6',
                                    strokeOpacity: 0,
                                    strokeWeight: 4,
                                    icons: [{
                                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                        )}

                        {customRouteDetails && (
                            <Polyline
                                path={customRouteDetails}
                                options={{
                                    strokeColor: isCongested ? '#EF4444' : '#9333EA', // Red if Congested, Purple otherwise
                                    strokeWeight: 6,
                                }}
                            />
                        )}

                        {/* GLOBAL AI HEATMAP */}
                        {showHeatmap && heatmapRoutes.map((h, i) => {
                            if (!h.path || h.path.length === 0) return null;
                            // Asignamos color basado en la puntuación ML: >0.7 Rojo, >0.4 Naranja, sino Verde translucido
                            const color = h.score > 0.7 ? '#EF4444' : h.score > 0.4 ? '#F59E0B' : '#10B981';
                            return (
                                <Polyline
                                    key={i}
                                    path={h.path}
                                    options={{
                                        strokeColor: color,
                                        strokeOpacity: h.score > 0.7 ? 0.9 : 0.5, // Resaltar más las rojas
                                        strokeWeight: h.score > 0.7 ? 8 : 4,
                                        zIndex: h.score > 0.7 ? 20 : 10
                                    }}
                                />
                            );
                        })}
                    </GoogleMap>
                ) : (
                    <div className="h-full flex items-center justify-center">Cargando mapas...</div>
                )}

                {/* BOTÓN GPS */}
                <button
                    onClick={centerOnUser}
                    className="absolute bottom-24 right-4 bg-white text-blue-600 p-3 rounded-full shadow-2xl z-[10] hover:bg-blue-100 transition-colors">
                    <LocateFixed className="w-6 h-6" />
                </button>

                {/* BOTÓN RUTAS */}
                <button
                    onClick={() => setShowRoutePanel(!showRoutePanel)}
                    className="absolute bottom-4 right-4 bg-[var(--app-blue)] text-white p-3 rounded-full shadow-xl z-[10] flex items-center gap-2">
                    <RouteIcon className="w-5 h-5" />
                    {showRoutePanel && <span className="text-sm font-medium">Rutas</span>}
                </button>

                {showRoutePanel && (
                    <div className="absolute bottom-20 right-4 bg-white rounded-lg shadow-2xl p-4 w-80 z-[10]">
                        <div className="flex justify-between items-center mb-4 text-gray-800">
                            <h3 className="font-bold">Navegación Interna</h3>
                            <X className="w-4 h-4 cursor-pointer" onClick={() => setShowRoutePanel(false)} />
                        </div>
                        <div className="space-y-4">
                            <select
                                className="w-full p-2 border rounded text-sm text-gray-700"
                                value={routeOrigin || ''}
                                onChange={(e) => setRouteOrigin(e.target.value === 'user' ? 'user' : Number(e.target.value))}
                            >
                                <option value="">Punto de origen...</option>
                                {userLocation && <option value="user" className="text-blue-600 font-bold">📍 Mi ubicación actual</option>}
                                {edificios.map(e => <option key={e.id_edificio} value={e.id_edificio}>{e.nombre}</option>)}
                            </select>
                            <select
                                className="w-full p-2 border rounded text-sm text-gray-700"
                                value={routeDestination || ''}
                                onChange={(e) => setRouteDestination(Number(e.target.value))}
                            >
                                <option value="">Destino final...</option>
                                {edificios.map(e => <option key={e.id_edificio} value={e.id_edificio}>{e.nombre}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={calculateRoute} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">Calcular</button>
                                <button onClick={clearRoute} className="p-2 bg-red-100 text-red-600 rounded"><X className="w-5 h-5" /></button>
                            </div>
                            {user?.rol === 'admin' && (
                                <button onClick={toggleHeatmap} className="w-full mt-2 bg-blue-600 text-white py-2 rounded flex items-center justify-center gap-2 font-bold shadow-md hover:bg-blue-700 transition-colors">
                                    <Eye className="w-4 h-4" />
                                    {showHeatmap ? 'Ocultar Heatmap AI' : 'Ver Heatmap Global'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* INFO PANEL */}
                {selectedMarker && (
                    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 w-72 z-[10]">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-blue-900">{selectedMarker.profesorNombre || selectedMarker.nombre}</h3>
                            <X className="w-4 h-4 cursor-pointer text-gray-400" onClick={() => setSelectedMarker(null)} />
                        </div>

                        {selectedMarker.type === 'profesor' ? (
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-700">{selectedMarker.departamento}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    {selectedMarker.nombre} - {selectedMarker.cubiculoInfo}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-600 mb-4">{selectedMarker.descripcion}</p>
                        )}

                        <button
                            onClick={() => { setRouteDestination(selectedMarker.id_edificio); setRouteOrigin('user'); setShowRoutePanel(true); }}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <Navigation className="w-3 h-3" /> Cómo llegar aquí
                        </button>
                    </div>
                )}

                {/* LEYENDA */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[10]">
                    <h4 className="text-xs font-semibold mb-2 text-gray-800 border-b pb-1">Leyenda</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" /> Tú (GPS)
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <MapPin className=" w-3 h-3 text-blue-500" />Edificios
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="w-4 h-0.5 border-t-2 border-blue-400 border-dashed" /> Caminando
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="w-4 h-1 bg-[#9333EA]" /> Camino Alterno (Interno)
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="w-4 h-1 bg-[#EF4444]" /> Zona Roja (Alto Flujo)
                        </div>
                        {routeInfo && (
                            <div className="mt-2 pt-2 border-t text-xs text-blue-600 font-semibold">
                                <div>Distancia: {routeInfo.distance}</div>
                                <div>Tiempo estimado: {routeInfo.duration}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="bg-white dark:bg-gray-900 border-t px-4 py-3 text-xs text-gray-500 flex justify-between items-center">
                <p>&copy; {new Date().getFullYear()} Vexel - UTEQ. AirGuide Project.</p>
                <div className="flex gap-4 underline">
                    <a href="https://www.uteq.edu.mx">UTEQ</a>
                    <a href="https://github.com/luiss811/Airguide">GitHub</a>
                </div>
            </footer>
        </div>
    );
}