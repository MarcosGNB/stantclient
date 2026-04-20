import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  PlusCircle, 
  History as HistoryIcon,
  Plus,
  Minus,
  X,
  Calendar,
  DollarSign,
  MapPin,
  ChevronLeft,
  Store,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Share2,
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  EyeOff,
  Smartphone,
  Share,
  PlusSquare,
  Search,
  User,
  ShieldCheck,
  Lock,
  LogOut,
  Users,
  Settings,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit
} from 'lucide-react';
import { format, startOfMonth, isToday, isThisWeek, isThisMonth, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { clsx } from 'clsx';
import { exportComponent } from './utils/exportUtils';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api' 
  : 'https://serverstant.onrender.com/api';

// Initial Setup: Token & Interceptors
const initialToken = localStorage.getItem('vapo_token');
if (initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Global Interceptor for Auth Errors
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      console.warn('Sesión inválida (401). Limpiando credenciales...');
      localStorage.clear(); 
      window.location.href = '/';
      return new Promise(() => {});
    }
    return Promise.reject(err);
  }
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stantes, setStantes] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedStante, setSelectedStante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddStante, setShowAddStante] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [exportData, setExportData] = useState(null); // { title, items, totals }
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Stante Deletion State
  const [deletingStanteId, setDeletingStanteId] = useState(null);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('vapo_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('vapo_user')));
  const [isBlocked, setIsBlocked] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }

    // Handle 403 (Blocked License)
    const blockInterceptor = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 403 && err.response?.data?.message?.includes('licencia mgnb')) {
          setIsBlocked(true);
        }
        return Promise.reject(err);
      }
    );

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed:', err));
      });
    }

    // Capture install prompt for Android
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show modal if not already installed (standalone mode check)
      if (!window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone) {
        setShowInstallModal(true);
      }
    });

    // For iOS, show it if not in standalone
    if (isIOSDevice && !window.navigator.standalone) {
      const hasSeenPrompt = localStorage.getItem('pwa_prompt_seen');
      if (!hasSeenPrompt) {
        setShowInstallModal(true);
      }
    }

    return () => axios.interceptors.response.eject(blockInterceptor);
  }, [token]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    setShowInstallModal(false);
  };

  const closeInstallModal = () => {
    localStorage.setItem('pwa_prompt_seen', 'true');
    setShowInstallModal(false);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('¿ELIMINAR PRODUCTO?\n\nEsto borrará permanentemente este producto del inventario de TODAS LAS SUCURSALES. El historial de ventas de este producto se mantendrá, pero aparecerá como "Eliminado".\n\n¿Deseas continuar?')) return;
    try {
      await axios.delete(`${API_URL}/products/${id}`);
      fetchInitialData();
    } catch(err) {
      alert(err.response?.data?.message || 'Error al eliminar producto');
    }
  };

  const handleDeleteStante = async (id, name) => {
    if (!window.confirm(`¿ELIMINAR SUCURSAL "${name.toUpperCase()}"?\n\n⚠️ ¡ESTA ACCIÓN ES DESTRUCTIVA E IRREVERSIBLE! ⚠️\n\nSe borrará de forma permanente:\n- Esta sucursal\n- Todo el historial de ventas en ${name}\n- Todas las reposiciones en ${name}\n- El stock de todos los productos almacenados en ${name}\n\n¿Estás totalmente seguro de continuar?`)) {
      setDeletingStanteId(null);
      return;
    }
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/stantes/${id}`);
      setDeletingStanteId(null);
      fetchInitialData();
    } catch(err) {
      alert(err.response?.data?.message || 'Error al eliminar sucursal');
      setLoading(false);
    }
  };

  const handlePointerDown = (id) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      setDeletingStanteId(id);
      isLongPress.current = true;
    }, 800);
  };

  const handlePointerCancel = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const fetchInitialData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [stRes, prRes] = await Promise.all([
        axios.get(`${API_URL}/stantes`),
        axios.get(`${API_URL}/products`)
      ]);
      setStantes(stRes.data);
      setProducts(prRes.data);
      setLoading(false);
    } catch (err) { console.error("Error loading data", err); setLoading(false); }
  };

  const handleLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('vapo_token', data.token);
    localStorage.setItem('vapo_user', JSON.stringify(data.user));
    // Importante: Actualizar el header global inmediatamente
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setIsBlocked(false);
    if (data.user.role === 'admin') setActiveTab('admin');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vapo_token');
    localStorage.removeItem('vapo_user');
  };

  if (!token) return <LoginView onLogin={handleLogin} />;
  if (isBlocked) return <LicenseBlockedView />;

  return (
    <div className="flex flex-col h-full bg-[#0f1115] text-white overflow-hidden font-sans">
      {/* Header */}
      {!selectedStante && (
        <header className="p-6 pb-2 animate-fade shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center p-1 relative overflow-hidden group">
                <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain p-0.5" />
                <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div onClick={handleLogout} className="cursor-pointer group">
                <h1 className="text-xl font-bold tracking-tight text-white leading-none group-hover:text-red-400 transition-colors">MGNB</h1>
                <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1 font-bold group-hover:opacity-0 transition-opacity">
                  {user?.role === 'admin' ? 'ADMIN CENTER' : 'GESTIÓN PRO'}
                </p>
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-red-400 font-black flex items-center gap-1">
                  <LogOut size={10} /> CERRAR SESIÓN
                </div>
              </div>
            </div>
            <div className="flex gap-2">
               {user?.role === 'admin' ? (
                  <button onClick={handleLogout} className="p-2 glass rounded-xl text-red-400" title="Cerrar Sesión"><LogOut size={20} /></button>
               ) : (
                  <>
                    <button onClick={() => setShowAddStante(true)} className="p-2 glass rounded-xl text-blue-400"><Store size={20} /></button>
                    <button onClick={() => setShowAddProduct(true)} className="p-2 glass rounded-xl text-emerald-400"><Package size={20} /></button>
                  </>
               )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {selectedStante ? (
          <StanteDetailView 
            stante={selectedStante} 
            products={products}
            onBack={() => { setSelectedStante(null); fetchInitialData(); }} 
            onSell={() => setShowSale(true)}
            onRestock={() => setShowRestock(true)}
            onExport={(data) => setExportData(data)}
          />
        ) : (
          <>
            {user?.role === 'admin' ? (
              <AdminPanelView />
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <div className="animate-fade">
                    <div className="flex justify-between items-center mb-4 px-2">
                       <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Mis Sucursales</h2>
                       <span className="text-[10px] font-black text-slate-700">@{user?.username}</span>
                    </div>
                    <div className="dashboard-grid">
                      {stantes.map(s => (
                        <div 
                          key={s._id} 
                          className={clsx("stante-card relative overflow-hidden transition-all duration-300", deletingStanteId === s._id ? "ring-2 ring-red-500 bg-red-500/10" : "")} 
                          onPointerDown={() => handlePointerDown(s._id)}
                          onPointerUp={handlePointerCancel}
                          onPointerLeave={handlePointerCancel}
                          onClick={() => {
                            if (isLongPress.current) return; // Ignore click triggered exactly after long-press timeout
                            if (deletingStanteId === s._id) {
                              handleDeleteStante(s._id, s.name);
                            } else {
                              if (deletingStanteId) setDeletingStanteId(null);
                              else setSelectedStante(s);
                            }
                          }}
                        >
                          <div className={clsx("transition-opacity", deletingStanteId === s._id ? "opacity-20" : "")}>
                            <div className="stante-icon-wrapper"><Store size={24} /></div>
                            <div>
                              <h3 className="font-bold text-sm">{s.name}</h3>
                              <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                                <MapPin size={8} /> {s.location || 'Sucursal'}
                              </p>
                            </div>
                          </div>
                          
                          {deletingStanteId === s._id && (
                            <div className="absolute inset-0 bg-red-600/90 flex flex-col items-center justify-center z-10 animate-fade">
                              <Trash2 className="text-white mb-2 animate-bounce" size={24} />
                              <span className="text-white font-black tracking-widest text-[10px]">ELIMINAR</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="stante-card bg-transparent border-dashed border-white/10" onClick={() => setShowAddStante(true)}>
                        <Plus size={24} className="text-slate-600" />
                      </div>
                    </div>
                    {stantes.length === 0 && (
                       <div className="mt-10 p-8 glass rounded-3xl text-center">
                          <Store className="mx-auto mb-4 text-slate-600" size={40} />
                          <p className="text-sm text-slate-500 font-medium">Aún no tienes sucursales.<br/>Crea la primera para empezar.</p>
                          <button onClick={() => setShowAddStante(true)} className="mt-5 text-blue-500 font-bold text-xs uppercase tracking-widest">Crear Sucursal</button>
                       </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'products' && (
                  <InventoryView 
                    products={products} 
                    stantes={stantes}
                    refresh={fetchInitialData} 
                    onAdd={() => setShowAddProduct(true)}
                    onExport={(data) => setExportData(data)}
                    onEdit={(p) => setEditingProduct(p)}
                    onDelete={handleDeleteProduct}
                  />
                )}

                {activeTab === 'reports' && <GlobalReportsView stantes={stantes} onExport={(data) => setExportData(data)} />}
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAddStante && <AddStanteModal onClose={() => setShowAddStante(false)} onSuccess={() => { setShowAddStante(false); fetchInitialData(); }} />}
      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} onSuccess={() => { setShowAddProduct(false); fetchInitialData(); }} />}
      {editingProduct && <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSuccess={() => { setEditingProduct(null); fetchInitialData(); }} />}
      {showSale && <SaleModal products={products} stantes={stantes} initialStante={selectedStante?.name} onClose={() => setShowSale(false)} onSuccess={() => { setShowSale(false); fetchInitialData(); }} />}
      {showRestock && <RestockModal products={products} stantes={stantes} initialStante={selectedStante?.name} onClose={() => setShowRestock(false)} onSuccess={() => { setShowRestock(false); fetchInitialData(); }} />}
      {exportData && <ExportModal data={exportData} onClose={() => setExportData(null)} />}
      
      {/* PWA Install Prompt */}
      {showInstallModal && (
        <PWAInstallModal 
          isIOS={isIOS} 
          onInstall={handleInstallClick} 
          onClose={closeInstallModal} 
        />
      )}

      {/* Navigation */}
      {!selectedStante && user?.role !== 'admin' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto glass border-t border-white/10 rounded-t-3xl px-6 py-4 flex justify-between items-center z-50">
          <NavButton active={activeTab === 'dashboard'} icon={<Store size={24} />} label="Panel" onClick={() => setActiveTab('dashboard')} />
          <NavButton active={activeTab === 'products'} icon={<Package size={24} />} label="Productos" onClick={() => setActiveTab('products')} />
          <NavButton active={activeTab === 'reports'} icon={<BarChart3 size={24} />} label="Negocio" onClick={() => setActiveTab('reports')} />
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className={clsx("flex flex-col items-center gap-1 transition-all duration-300", active ? "text-blue-500 scale-110" : "text-slate-500")}>
      <div className={clsx("p-1 rounded-xl", active && "bg-blue-500/10")}>{icon}</div>
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}

/* --- VIEWS --- */

const StanteDetailView = ({ stante, products, onBack, onSell, onRestock, onExport }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('stock');

  useEffect(() => { fetchStanteData(); }, [stante]);

  const fetchStanteData = async () => {
    try {
      const res = await axios.get(`${API_URL}/reports/stante/${stante.name}`);
      setData(res.data);
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  const handleExport = () => {
    const exportItems = data.sales.map(s => ({
      name: s.product?.name || 'Eliminado',
      quantity: s.quantity,
      price: s.salesPrice,
      total: s.total,
      profit: s.total - (s.purchasePrice * s.quantity)
    }));
    onExport({
      title: `Reporte - ${stante.name}`,
      mode: 'history',
      items: exportItems,
      totals: data.summary
    });
  };

  const handleExportStock = () => {
    const stockItems = products.filter(p => p.stock?.[stante.name] > 0).map(p => ({
      name: p.name,
      quantity: p.stock[stante.name],
      price: p.salesPrice,
      purchasePrice: p.purchasePrice,
      total: p.salesPrice * p.stock[stante.name]
    }));
    
    const totalValuation = stockItems.reduce((a, b) => a + b.total, 0);

    onExport({
      title: `Stock Actual - ${stante.name}`,
      mode: 'stock',
      items: stockItems,
      totals: { totalRevenue: totalValuation } // Use totalRevenue for total valuation
    });
  };

  if (loading) return <div className="text-center py-20 animate-pulse">Cargando sucursal...</div>;

  return (
    <div className="animate-fade pb-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 glass rounded-full text-slate-400"><ChevronLeft size={24} /></button>
          <div><h2 className="text-xl font-bold">{stante.name}</h2><p className="text-xs text-slate-500">{stante.location}</p></div>
        </div>
        <button onClick={view === 'stock' ? handleExportStock : handleExport} className="p-2 glass rounded-xl text-blue-400">
           <Share2 size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="card border-emerald-500/10 bg-emerald-500/5">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ganancia neta</span>
          <div className="text-xl font-bold text-emerald-400">Gs. {data?.summary.totalProfit.toLocaleString()}</div>
        </div>
        <div className="card">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ventas (Total)</span>
          <div className="text-xl font-bold">Gs. {data?.summary.totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-2 p-1 glass rounded-2xl mb-6">
        <button onClick={() => setView('stock')} className={clsx("flex-1 py-2 rounded-xl text-xs font-bold transition-all", view === 'stock' ? "bg-white/10 text-white" : "text-slate-500")}>INVENTARIO</button>
        <button onClick={() => setView('history')} className={clsx("flex-1 py-2 rounded-xl text-xs font-bold transition-all", view === 'history' ? "bg-white/10 text-white" : "text-slate-500")}>HISTORIAL</button>
      </div>

      {view === 'stock' ? (
        <div className="space-y-4">
          {products.filter(p => p.stock?.[stante.name] > 0).map(p => (
            <div key={p._id} className="glass p-4 rounded-2xl flex justify-between items-center border-white/5">
              <div><h4 className="font-bold text-sm">{p.name}</h4><p className="text-blue-400 text-xs font-bold mt-1">Gs. {p.salesPrice.toLocaleString()}</p></div>
              <div className="bg-white/5 px-3 py-1 rounded-lg text-xs font-bold text-slate-300">{p.stock[stante.name]} und.</div>
            </div>
          ))}
          <div className="flex gap-3 mt-8">
             <QuickButton icon={<ShoppingCart size={18} />} label="Vender" color="blue" onClick={onSell} />
             <QuickButton icon={<PlusCircle size={18} />} label="Reponer" color="emerald" onClick={onRestock} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {data?.sales.concat(data?.restocks).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item, index) => {
            const isSale = !!item.total;
            return (
              <div key={index} className="history-item">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">{format(new Date(item.createdAt), 'dd MMM, HH:mm')}</span>
                    <h4 className="text-sm font-bold">{item.product?.name || 'Eliminado'}</h4>
                    <p className="text-xs text-slate-400">{isSale ? 'Venta' : 'Reposición'}</p>
                  </div>
                  <div className="text-right">
                    <span className={clsx("text-sm font-bold block", isSale ? "text-emerald-400" : "text-blue-400")}>{isSale ? `+Gs. ${item.total.toLocaleString()}` : `+${item.quantity} und`}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

const GlobalReportsView = ({ stantes, onExport }) => {
  const [sales, setSales] = useState([]);
  const [stanteFilter, setStanteFilter] = useState('Global');
  const [timeFilter, setTimeFilter] = useState('Semana'); // Hoy, Semana, Mes, Todo, Personalizado
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        console.log('--- Fetching Global History ---');
        const [saleRes, restockRes] = await Promise.all([
          axios.get(`${API_URL}/sales`),
          axios.get(`${API_URL}/restocks`)
        ]);
        
        console.log('Recibidas Ventas:', saleRes.data.length);
        console.log('Recibidas Reposiciones:', restockRes.data.length);

        const allItems = [
          ...saleRes.data.map(s => ({ ...s, type: 'sale' })),
          ...restockRes.data.map(r => ({ ...r, type: 'restock' }))
        ];
        
        setSales(allItems);
      } catch (err) { 
        console.error("Error fetching global history:", err);
        setSales([]);
      }
    };
    fetchGlobal();
  }, []);

  const filteredSales = sales.filter(s => {
    const matchesStante = stanteFilter === 'Global' || s.stante === stanteFilter;
    const itemDate = new Date(s.createdAt);
    
    let matchesTime = true;
    if (timeFilter === 'Hoy') matchesTime = isToday(itemDate);
    else if (timeFilter === 'Semana') matchesTime = isThisWeek(itemDate);
    else if (timeFilter === 'Mes') matchesTime = isThisMonth(itemDate);
    else if (timeFilter === 'Personalizado') {
      matchesTime = isWithinInterval(itemDate, {
        start: startOfDay(new Date(customStart + 'T00:00:00')),
        end: endOfDay(new Date(customEnd + 'T23:59:59'))
      });
    }
    return matchesStante && matchesTime;
  }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totals = {
    totalRevenue: filteredSales.filter(i => i.type === 'sale').reduce((a, b) => a + b.total, 0),
    totalProfit: filteredSales.filter(i => i.type === 'sale').reduce((a, b) => a + (b.total - (b.purchasePrice * b.quantity)), 0)
  };

  const handleExport = () => {
    const title = timeFilter === 'Personalizado' 
      ? `Reporte ${customStart}_a_${customEnd}`
      : `Reporte ${timeFilter}`;

    onExport({
      title: `${title} - ${stanteFilter}`,
      mode: 'history',
      items: filteredSales.map(i => {
        const isSale = i.type === 'sale';
        return {
          name: `${i.product?.name || 'Eliminado'} (${isSale ? 'Venta' : 'Reposición'})`,
          quantity: i.quantity,
          price: isSale ? i.salesPrice : 0,
          total: isSale ? i.total : 0,
          profit: isSale ? (i.total - (i.purchasePrice * i.quantity)) : 0
        };
      }),
      totals
    });
  };

  return (
    <div className="animate-fade">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Negocio Global</h2>
        <button onClick={handleExport} className="p-2 glass rounded-xl text-blue-400"><Share2 size={20} /></button>
      </div>

      <div className="filter-scroll mb-2">
        <button onClick={() => setStanteFilter('Global')} className={clsx("filter-chip", stanteFilter === 'Global' && "active")}>GLOBAL</button>
        {stantes.map(s => (
          <button key={s._id} onClick={() => setStanteFilter(s.name)} className={clsx("filter-chip", stanteFilter === s.name && "active")}>{s.name}</button>
        ))}
      </div>

      <div className="time-segment mb-4">
        {['Hoy', 'Semana', 'Mes', 'Todo', 'Personalizado'].map(t => (
          <button key={t} onClick={() => setTimeFilter(t)} className={clsx("time-btn", timeFilter === t && "active")}>{t}</button>
        ))}
      </div>

      {timeFilter === 'Personalizado' && (
        <div className="grid grid-cols-2 gap-3 mb-6 p-4 glass rounded-[20px] animate-slide-up">
          <div className="form-group">
            <label className="text-[10px] text-slate-500 uppercase font-black mb-2 block">Desde</label>
            <input type="date" className="w-full bg-white/5 border-white/10 rounded-xl py-2 px-3 text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="text-[10px] text-slate-500 uppercase font-black mb-2 block">Hasta</label>
            <input type="date" className="w-full bg-white/5 border-white/10 rounded-xl py-2 px-3 text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid gap-3 mb-8">
        <div className="card bg-emerald-500/5 border-emerald-500/10">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Ganancia {timeFilter}</span>
          <div className="text-3xl font-bold text-emerald-400">Gs. {totals.totalProfit.toLocaleString()}</div>
        </div>
        <div className="card">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Ventas {timeFilter}</span>
          <div className="text-2xl font-bold">Gs. {totals.totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
        Feed: {stanteFilter} ({timeFilter})
      </h3>
      <div className="space-y-4">
        {filteredSales.slice(0, 50).map((item, index) => {
          const isSale = item.type === 'sale';
          return (
            <div key={index} className="glass p-4 rounded-xl flex justify-between items-center bg-white/2 border-white/5">
              <div>
                <div className="flex items-center gap-2">
                   <h4 className="font-bold text-sm">{item.product?.name || 'Eliminado'}</h4>
                   <span className={clsx("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", isSale ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                      {isSale ? 'VENTA' : 'REPOSICIÓN'}
                   </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{item.stante} • {format(new Date(item.createdAt), 'dd MMM, HH:mm')}</p>
              </div>
              <div className="text-right">
                <span className={clsx("text-sm font-bold block", isSale ? "text-emerald-400" : "text-blue-400")}>
                  {isSale ? `Gs. ${item.total.toLocaleString()}` : `+${item.quantity} und`}
                </span>
                {isSale && <span className="text-[10px] text-slate-600 block">+{item.quantity} und.</span>}
              </div>
            </div>
          );
        })}
        {filteredSales.length === 0 && (
          <div className="text-center py-10 text-slate-600 italic text-sm">Sin registros para este filtro</div>
        )}
      </div>
    </div>
  );
};

const ExportModal = ({ data, onClose }) => {
  const [formatType, setFormatType] = useState('png'); // png, pdf
  const [showProfit, setShowProfit] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    await exportComponent('export-ticket', formatType, data.title.replace(/\s+/g, '_').toLowerCase());
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">Exportar Reporte</h2>
        
        <div className="space-y-6">
          <div className="radio-group">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Formato de Archivo</label>
            <div className={clsx("radio-item", formatType === 'png' && "active")} onClick={() => setFormatType('png')}>
              <div className="radio-circle" /><ImageIcon size={20} /> <span>Imagen (PNG)</span>
            </div>
            <div className={clsx("radio-item", formatType === 'pdf' && "active")} onClick={() => setFormatType('pdf')}>
              <div className="radio-circle" /><FileText size={20} /> <span>Documento (PDF)</span>
            </div>
          </div>

          {data.mode === 'history' && (
            <div className="radio-group">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Privacidad de Ganancias</label>
              <div className={clsx("radio-item", !showProfit && "active")} onClick={() => setShowProfit(false)}>
                <div className="radio-circle" /><EyeOff size={20} /> <span>Ocultar Ganancias</span>
              </div>
              <div className={clsx("radio-item", showProfit && "active")} onClick={() => setShowProfit(true)}>
                <div className="radio-circle" /><Eye size={20} /> <span>Mostrar Ganancias</span>
              </div>
            </div>
          )}

          <button disabled={loading} onClick={handleExport} className="btn-primary flex justify-center items-center gap-2">
            {loading ? 'Generando...' : <><Download size={20} /> Descargar Reporte</>}
          </button>
        </div>

        {/* HIDDEN TICKET TEMPLATE FOR EXPORT */}
        <div className="export-hidden-container">
          <div id="export-ticket" className="ticket-template">
            <div className="ticket-header">
              <img src="/logo.svg" alt="Logo" className="ticket-logo" crossOrigin="anonymous" />
              <h1 style={{fontSize: '24px', margin: '0'}}>MGNB</h1>
              <p style={{fontSize: '12px', color: '#64748b', margin: '5px 0 0'}}>{data.title}</p>
              <p style={{fontSize: '10px', color: '#94a3b8', marginTop: '10px'}}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant</th>
                  {data.mode === 'stock' && <th>P.Cmpra</th>}
                  <th>P.Vta</th>
                  <th>Total Vta</th>
                  {data.mode === 'history' && showProfit && <th>Gan</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    {data.mode === 'stock' && <td>Gs. {item.purchasePrice?.toLocaleString() || 0}</td>}
                    <td>Gs. {item.price.toLocaleString()}</td>
                    <td>Gs. {item.total.toLocaleString()}</td>
                    {data.mode === 'history' && showProfit && <td style={{color: '#10b981', fontWeight: 'bold'}}>Gs. {item.profit.toLocaleString()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ticket-footer">
              <p style={{margin: '0', fontSize: '10px', color: '#64748b'}}>{data.mode === 'stock' ? 'VALORACIÓN TOTAL' : 'TOTAL VENTAS'}</p>
              <p style={{margin: '5px 0 0', fontSize: '20px', fontWeight: 'bold'}}>Gs.{data.totals.totalRevenue.toLocaleString()}</p>
              {data.mode === 'history' && showProfit && (
                <div style={{marginTop: '10px', color: '#10b981'}}>
                  <p style={{margin: '0', fontSize: '10px'}}>GANANCIA NETA TOTAL</p>
                  <p style={{margin: '0', fontSize: '16px', fontWeight: 'bold'}}>Gs.{data.totals.totalProfit.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickButton = ({ icon, label, color, onClick }) => (
  <button onClick={onClick} className={clsx("flex-1 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest text-white shadow-lg", color === 'blue' ? "bg-blue-600 shadow-blue-900/20" : "bg-emerald-600 shadow-emerald-900/20")}>
    {icon} {label}
  </button>
);

const InventoryView = ({ products, stantes, refresh, onAdd, onExport, onEdit, onDelete }) => {
  const [stanteFilter, setStanteFilter] = useState('Global');

  const filteredProducts = products.filter(p => {
    if (stanteFilter === 'Global') return true;
    return p.stock?.[stanteFilter] !== undefined; // shows all products, or we can just return true to list them all and see 0 stock. Let's list them all to see 0 stock.
  });

  const handleExport = () => {
    const stockItems = products.map(p => {
      const stockVal = stanteFilter === 'Global' 
        ? Object.values(p.stock || {}).reduce((a, b) => a + b, 0)
        : (p.stock?.[stanteFilter] || 0);
        
      if (stockVal === 0) return null;

      return {
        name: p.name,
        quantity: stockVal,
        price: p.salesPrice,
        purchasePrice: p.purchasePrice,
        total: p.salesPrice * stockVal,
        profit: (p.salesPrice - p.purchasePrice) * stockVal
      };
    }).filter(Boolean);

    const totalValuation = stockItems.reduce((a, b) => a + b.total, 0);

    onExport({
      title: `Inventario - ${stanteFilter}`,
      mode: 'stock',
      items: stockItems,
      totals: { totalRevenue: totalValuation } 
    });
  };

  return (
    <div className="animate-fade">
      <div className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-xl font-bold">Inventario Global</h2>
        <div className="flex gap-2">
          <button onClick={handleExport} className="p-2 glass rounded-xl text-blue-400" title="Exportar Reporte"><Share2 size={20} /></button>
          <button onClick={onAdd} className="bg-emerald-600 p-2 rounded-xl text-white" title="Agregar Producto"><Plus size={20} /></button>
        </div>
      </div>
      
      <div className="filter-scroll mb-4 px-2">
        <button onClick={() => setStanteFilter('Global')} className={clsx("filter-chip", stanteFilter === 'Global' && "active")}>GLOBAL</button>
        {stantes.map(s => (
          <button key={s._id} onClick={() => setStanteFilter(s.name)} className={clsx("filter-chip", stanteFilter === s.name && "active")}>{s.name}</button>
        ))}
      </div>

      <div className="grid gap-3">{products.map(p => {
          const total = stanteFilter === 'Global' ? Object.values(p.stock || {}).reduce((a,b) => a+b, 0) : (p.stock?.[stanteFilter] || 0);
          return (
            <div key={p._id} className="glass p-4 rounded-2xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">{p.name}</h3>
                <div className="flex flex-col mt-1">
                  <span className="text-xs text-blue-400 font-bold">Venta: Gs. {p.salesPrice.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 font-bold">Compra: Gs. {p.purchasePrice?.toLocaleString() || 0}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={clsx("px-3 py-1 rounded-lg text-[10px] font-bold mb-1 w-fit ml-auto", total > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>{total} STOCK</div>
                <span className="text-[10px] text-emerald-500 block">Val: Gs. {(p.salesPrice * total).toLocaleString()}</span>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => onEdit(p)} className="p-1.5 glass rounded-lg text-blue-400 hover:bg-blue-500/20" title="Editar Producto"><Edit size={14} /></button>
                  <button onClick={() => onDelete(p._id)} className="p-1.5 glass rounded-lg text-red-400 hover:bg-red-500/20" title="Eliminar Producto"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

/* EXISTING MODALS (Keep but cleaner) */
function SaleModal({ products, stantes, initialStante, onClose, onSuccess }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [selectedStante, setSelectedStante] = useState(initialStante || '');
  const [quantity, setQuantity] = useState(1);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return selectedStante ? (matchesSearch && p.stock?.[selectedStante] > 0) : matchesSearch;
  });

  const handleSale = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_URL}/sales`, { productId: selectedProd, stante: selectedStante, quantity }); onSuccess(); }
    catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">Vender Producto</h2>
        
        <form onSubmit={handleSale} className="space-y-6">
          <div className="form-group">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2 block">1. Elegir Producto (Con Stock)</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                className="w-full pl-10 h-12 bg-white/5 border-white/10 rounded-xl text-sm"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setSelectedProd(''); // Clean selection if they type again
                }}
              />
            </div>
            
            {!selectedProd && (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div 
                    key={p._id} 
                    onClick={() => {
                      setSelectedProd(p._id);
                      setSearchTerm(p.name);
                    }}
                    className="p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center bg-white/5 border-transparent hover:bg-white/10"
                  >
                    <div>
                      <span className="text-sm font-bold block">{p.name}</span>
                      {selectedStante && (
                        <span className="text-[10px] text-blue-400 font-medium">
                          Disponibles: {p.stock[selectedStante] || 0} und.
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white font-bold opacity-80">Gs. {p.salesPrice.toLocaleString()}</span>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-6 text-slate-600 italic text-sm">
                    {selectedStante ? 'No hay productos con stock en esta sucursal' : 'Busca un producto...'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label>Sucursal</label>
              <select className="w-full h-12" value={selectedStante} onChange={e => setSelectedStante(e.target.value)} required disabled={!!initialStante}>
                <option value="">Sucursal...</option>
                {stantes.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input type="number" className="w-full h-12 text-center text-lg font-bold" value={quantity} onChange={e => { const v = parseInt(e.target.value); setQuantity(isNaN(v) ? '' : v); }} min="1" required />
            </div>
          </div>

          <button 
            type="submit"
            disabled={!selectedProd || !selectedStante || quantity < 1}
            className="btn-primary w-full h-14 text-sm font-black tracking-widest shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CONFIRMAR VENTA
          </button>
        </form>
      </div>
    </div>
  );
}

function RestockModal({ products, stantes, initialStante, onClose, onSuccess }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [selectedStante, setSelectedStante] = useState(initialStante || '');
  const [quantity, setQuantity] = useState(1);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestock = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_URL}/restocks`, { productId: selectedProd, stante: selectedStante, quantity }); onSuccess(); }
    catch (err) { alert('Error'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">Reponer Stock</h2>
        <form onSubmit={handleRestock} className="space-y-6">
          <div className="form-group">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2 block">1. Seleccionar Producto</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                className="w-full pl-10 h-12 bg-white/5 border-white/10 rounded-xl text-sm"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setSelectedProd('');
                }}
              />
            </div>

            {!selectedProd && (
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredProducts.map(p => (
                  <div 
                    key={p._id} 
                    onClick={() => {
                      setSelectedProd(p._id);
                      setSearchTerm(p.name);
                    }}
                    className="p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center bg-white/5 border-transparent hover:bg-white/10"
                  >
                    <div>
                      <span className="text-sm font-bold block">{p.name}</span>
                      {selectedStante && (
                        <span className="text-[10px] text-blue-400 font-medium">
                          Actual: {p.stock[selectedStante] || 0} und.
                        </span>
                      )}
                    </div>
                    {!selectedStante && <span className="text-xs text-emerald-400 font-bold">Global: {Object.values(p.stock || {}).reduce((a,b)=>a+b,0)} und.</span>}
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-6 text-slate-600 italic text-sm">
                    No se encontraron productos.
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="form-group">
               <label>Sucursal</label>
               <select className="w-full h-12" value={selectedStante} onChange={e => setSelectedStante(e.target.value)} required disabled={!!initialStante}>
                 <option value="">Sucursal...</option>
                 {stantes.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
               </select>
             </div>
             <div className="form-group">
               <label>Cantidad</label>
               <input type="number" className="w-full h-12 text-center text-lg font-bold" value={quantity} onChange={e => { const v = parseInt(e.target.value); setQuantity(isNaN(v) ? '' : v); }} min="1" required />
             </div>
          </div>
          <button 
            type="submit"
            disabled={!selectedProd || !selectedStante || quantity < 1}
            className="btn-primary w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-sm font-black tracking-widest shadow-xl shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            GUARDAR REPOSICIÓN
          </button>
        </form>
      </div>
    </div>
  );
}

const AddStanteModal = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_URL}/stantes`, { name, location }); onSuccess(); } catch (err) { alert('Error'); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold mb-6">Nueva Sucursal</h2><form onSubmit={handleSubmit} className="space-y-4"><div className="form-group"><label>Nombre</label><input autoFocus type="text" className="w-full" value={name} onChange={e => setName(e.target.value)} required /></div><div className="form-group"><label>Ubicación</label><input type="text" className="w-full" value={location} onChange={e => setLocation(e.target.value)} /></div><button className="btn-primary">Crear</button></form></div></div>
  )
}

const AddProductModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ name: '', purchasePrice: '', salesPrice: '' });
  const handleSubmit = async (e) => { e.preventDefault(); try { await axios.post(`${API_URL}/products`, { ...formData, purchasePrice: parseFloat(formData.purchasePrice), salesPrice: parseFloat(formData.salesPrice) }); onSuccess(); } catch (err) { alert('Error'); } };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold mb-6">Nuevo Producto</h2><form onSubmit={handleSubmit} className="space-y-4"><div className="form-group"><label>Nombre</label><input autoFocus type="text" className="w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div><div className="grid grid-cols-2 gap-4"><div className="form-group"><label>Precio Compra</label><input type="number" className="w-full" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} required /></div><div className="form-group"><label>Precio Venta</label><input type="number" className="w-full" value={formData.salesPrice} onChange={e => setFormData({...formData, salesPrice: e.target.value})} required /></div></div><button className="btn-primary">Crear</button></form></div></div>
  )
}

const EditProductModal = ({ product, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ 
    name: product.name, 
    purchasePrice: product.purchasePrice || '', 
    salesPrice: product.salesPrice || '' 
  });
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    try { 
      await axios.put(`${API_URL}/products/${product._id}`, { 
        name: formData.name,
        purchasePrice: parseFloat(formData.purchasePrice), 
        salesPrice: parseFloat(formData.salesPrice) 
      }); 
      onSuccess(); 
    } catch (err) { 
      alert(err.response?.data?.message || 'Error'); 
    } 
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Editar Producto</h2>
        
        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs p-3 rounded-xl mb-6">
          <strong>Aviso:</strong> Si cambias los precios aquí, esto <strong>solo afectará</strong> a las transferencias y reportes desde este momento en adelante. Las ventas y balances históricos guardados en el historial mantendrán los precios originales intactos.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label>Nombre</label>
            <input autoFocus type="text" className="w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label>Precio Compra</label>
              <input type="number" className="w-full" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Precio Venta</label>
              <input type="number" className="w-full" value={formData.salesPrice} onChange={e => setFormData({...formData, salesPrice: e.target.value})} required />
            </div>
          </div>
          <button className="btn-primary">Guardar Cambios</button>
        </form>
      </div>
    </div>
  )
}

function LoginView({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, formData);
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error en la conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0d] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[120px] rounded-full" />
      
      <div className="glass max-w-sm w-full p-8 rounded-[32px] relative z-10 border-white/5">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mb-4 border-white/10 shadow-2xl">
            <ShieldCheck className="text-blue-500" size={32} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">MGNB</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Usuario</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
              <input 
                type="text" 
                className="w-full h-12 pl-12 pr-4 bg-white/5 border-white/10 rounded-2xl text-sm focus:border-blue-500/50 transition-all font-medium"
                placeholder="Nombre de usuario"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="text-[10px] uppercase font-bold text-slate-500 mb-2 block">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
              <input 
                type="password" 
                className="w-full h-12 pl-12 pr-4 bg-white/5 border-white/10 rounded-2xl text-sm focus:border-blue-500/50 transition-all font-medium"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold text-center animate-shake">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-900/20 mt-2"
          >
            {loading ? 'CARGANDO...' : 'ENTRAR AL SISTEMA'}
          </button>

          <p className="text-center text-[10px] font-bold text-slate-600 pt-6 uppercase tracking-widest">
            MGNB SOFTWARE SOLUTIONS
          </p>
        </form>
      </div>
    </div>
  );
}

function LicenseBlockedView() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0b0d] flex items-center justify-center p-8">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[120px] rounded-full" />
      <div className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-3xl p-10 rounded-[40px] text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse border border-red-500/20">
          <AlertTriangle className="text-red-500" size={40} />
        </div>
        <h1 className="text-3xl font-black mb-4 tracking-tight">ACCESO DENEGADO</h1>
        <div className="h-1 w-12 bg-red-500 mx-auto rounded-full mb-6 opacity-50" />
        <p className="text-slate-400 text-lg leading-relaxed mb-10 font-medium italic">
          "bloqueado temporalmente por motivos de licencia mgnb"
        </p>
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">MGNB SOFTWARE SOLUTIONS</p>
      </div>
    </div>
  );
}

function AdminPanelView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/users`);
      setUsers(res.data);
    } catch (err) { alert('Error al cargar usuarios'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/users`, newUser);
      setNewUser({ username: '', password: '' });
      setShowAddUser(false);
      fetchUsers();
      alert('Usuario creado correctamente');
    } catch (err) { alert('Error al crear usuario'); }
  };

  const toggleStatus = async (id) => {
    try {
      await axios.patch(`${API_URL}/admin/users/${id}/status`);
      fetchUsers();
    } catch (err) { alert('No se pudo cambiar el estado'); }
  };

  const deleteUser = async (id) => {
    if (!confirm('¿ESTÁS SEGURO? Se borrarán TODOS los datos de este usuario.')) return;
    try {
      await axios.delete(`${API_URL}/admin/users/${id}`);
      fetchUsers();
    } catch (err) { alert('Error al eliminar'); }
  };

  return (
    <div className="animate-fade">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black">ADMINISTRADOR</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gestión de Licencias MGNB</p>
        </div>
        <button 
          onClick={() => setShowAddUser(!showAddUser)}
          className={clsx("w-12 h-12 glass rounded-2xl flex items-center justify-center transition-all", showAddUser ? "text-red-400" : "text-blue-500")}
        >
          {showAddUser ? <X size={24} /> : <PlusCircle size={24} />}
        </button>
      </div>

      {showAddUser && (
        <div className="glass p-6 rounded-[24px] border-blue-500/20 mb-8 animate-slide-up">
          <h3 className="text-xs font-black uppercase tracking-widest mb-6">Nuevo Usuario Comercial</h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="form-group sm-group">
              <label>Usuario</label>
              <input 
                type="text" 
                className="w-full h-10" 
                value={newUser.username} 
                onChange={e => setNewUser({...newUser, username: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group sm-group">
              <label>Contraseña Inicial</label>
              <input 
                type="password" 
                className="w-full h-10" 
                value={newUser.password} 
                onChange={e => setNewUser({...newUser, password: e.target.value})} 
                required 
              />
            </div>
            <button className="btn-primary w-full h-12 mt-2 text-xs">CREAR LICENCIA</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {users.map(u => (
          <div key={u._id} className="glass p-5 rounded-[24px] border-white/5 flex justify-between items-center bg-white/2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm tracking-tight">{u.username.toUpperCase()}</h3>
                <span className={clsx(
                  "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                  u.status === 'active' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500"
                )}>
                  {u.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-bold">Desde: {format(new Date(u.createdAt), 'dd MMMM, yyyy')}</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => toggleStatus(u._id)}
                title={u.status === 'active' ? 'Bloquear' : 'Activar'}
                className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  u.status === 'active' ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                )}
              >
                {u.status === 'active' ? <Lock size={18} /> : <RotateCcw size={18} />}
              </button>
              {u.role !== 'admin' && (
                <button 
                  onClick={() => deleteUser(u._id)}
                  className="w-10 h-10 bg-white/5 text-slate-500 hover:bg-red-600 hover:text-white rounded-xl flex items-center justify-center transition-all"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PWAInstallModal({ isIOS, onInstall }) {
  return (
    <div className="pwa-overlay">
      <div className="pwa-glow-1" />
      <div className="pwa-glow-2" />
      
      <div className="pwa-content">
        <div className="bg-black/40 p-4 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl mx-auto w-fit mb-6 ring-1 ring-white/10 relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
          <img src="/logo.svg" alt="logo" className="w-10 h-10 object-contain brightness-110 relative z-10" />
        </div>
        <h1 className="text-3xl font-black text-center mb-2 tracking-tight">MGNB</h1>
        
        <div className="mb-14">
          <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full mb-4 opacity-50" />
          <p className="text-slate-400 text-sm max-w-[260px] mx-auto leading-relaxed font-medium">
            Sistema de gestión optimizado. Instala la aplicación para continuar.
          </p>
        </div>

        {isIOS ? (
          <div className="pwa-ios-card">
            <div className="flex items-start gap-5">
              <div className="pwa-step-icon">1</div>
              <p className="text-sm text-slate-200 leading-snug">Presiona el icono <span className="bg-white/10 p-2 rounded-xl inline-flex items-center mx-1"><Share size={16} /></span> en tu navegador.</p>
            </div>
            <div className="flex items-start gap-5">
              <div className="pwa-step-icon">2</div>
              <p className="text-sm text-slate-200 leading-snug">Elige <span className="font-bold text-white whitespace-nowrap">"Agregar al inicio"</span> <span className="bg-white/10 p-2 rounded-xl inline-flex items-center mx-1"><PlusSquare size={16} /></span></p>
            </div>
          </div>
        ) : (
          <button 
            onClick={onInstall}
            className="pwa-install-btn"
          >
            <Smartphone size={24} /> INSTALAR AHORA
          </button>
        )}
        <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">Gestión Exclusiva MGNB</p>
      </div>
    </div>
  );
}

export default App;
