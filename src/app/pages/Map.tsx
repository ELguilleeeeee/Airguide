// ==========================
// CAMBIOS VISUALES Y UX ONLY
// NO SE MODIFICA LÓGICA
// ==========================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin,
    Navigation,
    Building2,
    Route as RouteIcon,
    X,
    LocateFixed,
    Eye,
    MoreVertical
} from 'lucide-react';

import logoUTEQ from '../../styles/images/letras_uteq_azul2025.png';

import { useEdificios, useEventos, useProfesores } from '../hooks';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { SearchBar } from '../components/SearchBar';

import {
    GoogleMap,
    useJsApiLoader,
    Marker,
    DirectionsRenderer,
    Polyline
} from '@react-google-maps/api';

import { toast } from 'sonner';

const center = { lat: 20.656333, lng: -100.404745 };

const containerStyle = {
    width: '100%',
    height: '100%'
};

// =========================
// ICONOS
// =========================

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

    const [showOptionsMenu, setShowOptionsMenu] = useState(false);

    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);

    const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);

    const [autoStitchLines, setAutoStitchLines] = useState<{
        startLine: google.maps.LatLngLiteral[] | null;
        endLine: google.maps.LatLngLiteral[] | null;
    }>({
        startLine: null,
        endLine: null
    });

    const [customRouteDetails, setCustomRouteDetails] = useState<google.maps.LatLngLiteral[] | null>(null);

    const [isCongested, setIsCongested] = useState(false);

    const [showHeatmap, setShowHeatmap] = useState(false);

    const [heatmapRoutes, setHeatmapRoutes] = useState<Array<{
        path: google.maps.LatLngLiteral[],
        score: number
    }>>([]);

    // =========================
    // GEOLOCALIZACION
    // =========================

    useEffect(() => {

        if (!navigator.geolocation) return;

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {

                const { latitude, longitude } = position.coords;

                setUserLocation({
                    lat: latitude,
                    lng: longitude
                });

            },
            (err) => console.error("Error GPS:", err),
            {
                enableHighAccuracy: true
            }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };

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

    // =========================
    // FILTROS
    // =========================

    const canViewProfesores =
        user &&
        ['alumno', 'admin', 'rector'].includes(user.rol);

    const profesoresFiltrados = canViewProfesores
        ? profesores.filter(p =>
            p.usuario?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.departamento?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    const edificiosFiltrados = edificios.filter(e => {

        const matchesEdificio =
            e.nombre.toLowerCase().includes(searchTerm.toLowerCase());

        const hasMatchingProfesor = profesoresFiltrados.some(p =>
            p.cubiculos?.some(c => c.id_edificio === e.id_edificio)
        );

        return matchesEdificio || (searchTerm !== '' && hasMatchingProfesor);

    });

    // =========================
    // RENDER
    // =========================

    if (loadError) {
        return (
            <div className="h-screen flex items-center justify-center">
                Error cargando Google Maps
            </div>
        );
    }

    return (

        <div className="h-screen flex flex-col bg-[var(--app-bg)] overflow-hidden">

            {/* ================= HEADER ================= */}

            <header className="bg-[var(--app-header-bg)] border-b border-[var(--app-border)] px-4 py-3 flex items-center justify-between z-50">
                <div className="flex items-center gap-4">

                    <img
                        src={logoUTEQ}
                        alt="Logo UTEQ"
                        className="h-9 object-contain"
                    />

                    <div>
                        <h1 className="text-2xl font-bold text-[var(--app-text-primary)] tracking-tight">
                            AirGuide
                        </h1>

                        <p className="text-xs text-gray-500">
                            Navegación Inteligente UTEQ
                        </p>
                    </div>

                </div>

                <div className="flex items-center gap-3">

                    <ThemeToggle />

                    {user?.rol === "admin" && (

                        <button
                            onClick={() => navigate('/admin')}
                            className="bg-[var(--app-blue)] text-white px-4 py-2 rounded-2xl text-sm shadow-lg hover:scale-105 transition-all duration-300"
                        >
                            Dashboard
                        </button>

                    )}

                    {user ? (

                        <button
                            onClick={() => {
                                logout();
                                navigate('/login');
                            }}
                            className="bg-red-500 text-white px-4 py-2 rounded-2xl text-sm shadow-lg hover:scale-105 transition-all duration-300"
                        >
                            Cerrar sesión
                        </button>

                    ) : (

                        <button
                            onClick={() => navigate('/login')}
                            className="bg-[var(--app-blue)] text-white px-4 py-2 rounded-2xl text-sm shadow-lg hover:scale-105 transition-all duration-300"        >
                            Iniciar sesión
                        </button>

                    )}

                </div>

            </header>

            {/* ================= SEARCHBAR ================= */}

            <div className="sticky top-0 z-40 bg-[var(--app-header-bg)]/70 backdrop-blur-xl border-b border-[var(--app-border)] px-4 py-3 flex items-center gap-3">

                <div className="flex-1">

                    <SearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        profesoresFiltrados={profesoresFiltrados}
                        canViewProfesores={!!canViewProfesores}
                        onProfesorSelect={(p, cubiculo) => {

                            const ed = cubiculo.edificio;

                            if (ed && map) {

                                map.panTo({
                                    lat: Number(ed.latitud),
                                    lng: Number(ed.longitud)
                                });

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

                </div>

                {/* MENU 3 PUNTOS CON TEXTO "MENU" */}

                <div className="relative flex flex-col items-center">
                    
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 select-none">
                        Menu
                    </span>

                    <button
                        onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                        className="p-3 rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 shadow-xl hover:scale-105 transition-all duration-300"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {showOptionsMenu && (

                        <div className="absolute right-0 mt-14 w-64 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden z-50">

                            <button
                                onClick={() => {
                                    setShowRoutePanel(true);
                                    setShowOptionsMenu(false);
                                }}
                                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                            >
                                <RouteIcon className="w-4 h-4" />
                                Navegación interna
                            </button>

                            <button
                                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                            >
                                <Eye className="w-4 h-4" />
                                Heatmap AI
                            </button>

                            <button
                                className="w-full px-5 py-4 flex items-center gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all"
                            >
                                <X className="w-4 h-4" />
                                Limpiar ruta
                            </button>

                        </div>

                    )}

                </div>

            </div>

            {/* ================= MAPA ================= */}

            <div className="flex-1 relative">

                {isLoaded ? (

                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={15}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                            zoomControl: false
                        }}
                    >

                        {/* TU UBICACION */}

                        {userLocation && (

                            <Marker
                                position={userLocation}
                                icon={{
                                    path: window.google.maps.SymbolPath.CIRCLE,
                                    scale: 9,
                                    fillColor: "#3B82F6",
                                    fillOpacity: 0.9,
                                    strokeColor: "white",
                                    strokeWeight: 3,
                                }}
                            />

                        )}

                        {/* EDIFICIOS */}

                        {edificiosFiltrados.map((edificio) => (

                            <Marker
                                key={edificio.id_edificio}
                                position={{
                                    lat: Number(edificio.latitud),
                                    lng: Number(edificio.longitud)
                                }}
                                icon={{
                                    url: getIcon('#3B82F6', '#1E40AF'),
                                    scaledSize: new window.google.maps.Size(30, 40),
                                    anchor: new window.google.maps.Point(10, 35),
                                }}
                                onClick={() => {

                                    if (map) {

                                        map.panTo({
                                            lat: Number(edificio.latitud),
                                            lng: Number(edificio.longitud)
                                        });

                                    }

                                    setSelectedMarker({
                                        ...edificio,
                                        type: 'edificio'
                                    });

                                }}
                            />

                        ))}

                        {/* RUTAS */}

                        {directionsResponse && (

                            <DirectionsRenderer
                                options={{
                                    directions: directionsResponse,
                                    polylineOptions: {
                                        strokeColor: '#3B82F6',
                                        strokeWeight: 6,
                                        strokeOpacity: 0.8
                                    },
                                    suppressMarkers: true
                                }}
                            />

                        )}

                    </GoogleMap>

                ) : (

                    <div className="h-full flex items-center justify-center">
                        Cargando mapas...
                    </div>

                )}

                {/* ================= BOTON GPS ================= */}

                <button
                    onClick={centerOnUser}
                    className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-xl border border-white/20 text-blue-600 p-4 rounded-2xl shadow-2xl z-[10] hover:scale-110 transition-all duration-300"
                >
                    <LocateFixed className="w-6 h-6" />
                </button>

                {/* ================= PANEL RUTAS ================= */}

                {showRoutePanel && (

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-6 w-[420px] z-[20]">

                        <div className="flex justify-between items-center mb-6">

                            <div>
                                <h3 className="font-bold text-xl">
                                    Navegación
                                </h3>

                                <p className="text-sm text-gray-500">
                                    Calcula tu ruta dentro del campus
                                </p>
                            </div>

                            <button
                                onClick={() => setShowRoutePanel(false)}
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>

                        <div className="space-y-4">

                            <select
                                className="w-full p-4 rounded-2xl border bg-white dark:bg-gray-800"
                                value={routeOrigin || ''}
                                onChange={(e) =>
                                    setRouteOrigin(
                                        e.target.value === 'user'
                                            ? 'user'
                                            : Number(e.target.value)
                                    )
                                }
                            >
                                <option value="">
                                    Punto de origen
                                </option>

                                {userLocation && (
                                    <option value="user">
                                        📍 Mi ubicación actual
                                    </option>
                                )}

                                {edificios.map(e => (
                                    <option
                                        key={e.id_edificio}
                                        value={e.id_edificio}
                                    >
                                        {e.nombre}
                                    </option>
                                ))}

                            </select>

                            <select
                                className="w-full p-4 rounded-2xl border bg-white dark:bg-gray-800"
                                value={routeDestination || ''}
                                onChange={(e) =>
                                    setRouteDestination(Number(e.target.value))
                                }
                            >
                                <option value="">
                                    Destino final
                                </option>

                                {edificios.map(e => (
                                    <option
                                        key={e.id_edificio}
                                        value={e.id_edificio}
                                    >
                                        {e.nombre}
                                    </option>
                                ))}

                            </select>

                            <button
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-xl hover:scale-[1.02] transition-all duration-300"
                            >
                                Calcular Ruta
                            </button>

                        </div>

                    </div>

                )}

                {/* ================= INFO PANEL ================= */}

                {selectedMarker && (

                    <div className="absolute top-6 right-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-5 w-80 z-[20]">

                        <div className="flex justify-between items-start mb-4">

                            <div>

                                <h3 className="text-xl font-bold text-blue-900 dark:text-white">
                                    {selectedMarker.profesorNombre || selectedMarker.nombre}
                                </h3>

                                <p className="text-sm text-gray-500 mt-1">
                                    Información del edificio
                                </p>

                            </div>

                            <button
                                onClick={() => setSelectedMarker(null)}
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-4 h-4" />
                            </button>

                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            {selectedMarker.descripcion}
                        </p>

                        <button
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <Navigation className="w-4 h-4" />
                            Cómo llegar aquí
                        </button>

                    </div>

                )}

                {/* ================= LEYENDA ================= */}

                <div className="absolute bottom-6 left-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-4 w-56 z-[10]">

                    <h4 className="text-sm font-bold mb-4">
                        Leyenda
                    </h4>

                    <div className="space-y-3 text-xs">

                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            Tu ubicación
                        </div>

                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            Edificios
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-5 h-1 border-t-2 border-blue-400 border-dashed" />
                            Caminando
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-5 h-1 bg-[#9333EA]" />
                            Ruta interna
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-5 h-1 bg-[#EF4444]" />
                            Zona congestionada
                        </div>

                    </div>

                </div>

            </div>

            {/* ================= FOOTER ================= */}

            <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-[var(--app-border)] px-6 py-4 text-xs text-gray-500 flex justify-between items-center">

                <p>
                    © {new Date().getFullYear()} Vexel • AirGuide
                </p>

                <div className="flex gap-5 underline">

                    <a href="https://www.uteq.edu.mx">
                        UTEQ
                    </a>

                    <a href="https://github.com/luiss811/Airguide">
                        GitHub
                    </a>

                </div>

            </footer>

        </div>
    );
}