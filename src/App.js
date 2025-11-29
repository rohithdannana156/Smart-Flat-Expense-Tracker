/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Receipt, Users, Settings, Plus, LogOut, BrainCircuit, 
  Camera, ArrowRightLeft, Trash2, Menu, X, Loader2, 
  Wallet, FileText, Edit2, History, Copy, Smile, Frown, Meh, 
  Calendar, ShoppingBag, Download, AlertTriangle, TrendingUp, 
  Mail, RefreshCw, UserCircle, Lock, Database, ShieldAlert, Upload, HardDriveDownload, Search, CheckCircle, Dumbbell
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';

// --- Configuration Loader ---

const getFirebaseConfig = () => {
    // 1. Try Canvas Environment
    if (typeof __firebase_config !== 'undefined') {
        return JSON.parse(__firebase_config);
    }
    
    // 2. Try Local Environment Variables (Standard Create React App / Webpack)
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FIREBASE_API_KEY) {
        return {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID,
            measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
        };
    }

    // 3. Try Vite Environment Variables
    try {
        // @ts-ignore
        if (import.meta && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
            return {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID,
                measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
            };
        }
    } catch (e) {}

    // 4. Fallback to provided keys
    return {
        apiKey: "AIzaSyBranQsDXJBQTImsSLi4Tis_llVyYNc4bc",
        authDomain: "flat-expense-tracker-56e26.firebaseapp.com",
        projectId: "flat-expense-tracker-56e26",
        storageBucket: "flat-expense-tracker-56e26.firebasestorage.app",
        messagingSenderId: "663844707634",
        appId: "1:663844707634:web:eec3b2b96fa292ea8ecb2b",
        measurementId: "G-ZZNSHYK9GZ"
    };
};

const getGeminiApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GEMINI_API_KEY) {
        return process.env.REACT_APP_GEMINI_API_KEY;
    }
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}
  
  // Return the provided key as fallback
  return "AIzaSyCQzD5fdnSVdCPg98vo94r3O-tpp6bmSQA";
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Hardcoded members for the flat (Preserved from Old Project)
const flatMembers = [
    { id: 'anudeep', name: 'Anudeep' },
    { id: 'karthik', name: 'Karthik' },
    { id: 'mahesh', name: 'Mahesh' },
    { id: 'rohith', name: 'Rohith' },
    { id: 'shiva', name: 'Shiva' },
];

const COLORS = ['#00897B', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const FirebaseContext = createContext(null);

// --- AI Helper ---
const generateGeminiResponse = async (prompt, imageBase64 = null) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing. Check your .env file.");

  const model = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = [{ parts: [{ text: prompt }, ...(imageBase64 ? [{ inlineData: { mimeType: "image/png", data: imageBase64 } }] : [])] }];
  
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
  } catch (error) { 
      console.error("Gemini API Failed:", error); 
      throw error; 
  }
};

// --- Dynamic Script Loader for PDF Generation ---
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

const loadPDFLibs = async () => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
};

// --- PDF Generator Function ---
const generateReportPDF = async (expenses, startDate, endDate) => {
    await loadPDFLibs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let currentY = 20;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 137, 123); // Teal color
    doc.text("Flat Expense Report", margin, currentY);
    currentY += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, currentY);
    currentY += 6;
    if (startDate && endDate) {
        doc.text(`Period: ${startDate} to ${endDate}`, margin, currentY);
        currentY += 10;
    } else {
        currentY += 4;
    }

    // Summary
    const totalSpent = expenses.reduce((acc, ex) => acc + (ex.cost || 0), 0);
    
    doc.setDrawColor(0, 137, 123);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Total Spent: Rs ${totalSpent.toFixed(2)}`, margin, currentY);
    doc.text(`Transactions: ${expenses.length}`, margin + 80, currentY);
    currentY += 15;

    // Table
    const tableRows = expenses.map(ex => {
        const dateStr = ex.date instanceof Date ? ex.date.toLocaleDateString() : new Date(ex.date).toLocaleDateString();
        const buyerName = flatMembers.find(m => m.id === ex.buyerId)?.name || ex.buyerId;
        const sharedNames = ex.sharedWith?.map(id => flatMembers.find(m => m.id === id)?.name).join(', ') || 'None';
        
        return [
            dateStr,
            ex.itemName,
            ex.category,
            buyerName,
            `Rs ${ex.cost.toFixed(2)}`,
            sharedNames
        ];
    });

    doc.autoTable({
        startY: currentY,
        head: [['Date', 'Item', 'Category', 'Buyer', 'Cost', 'Shared With']],
        body: tableRows,
        headStyles: { fillColor: [0, 137, 123], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] }, // Light teal alternate
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        columnStyles: { 5: { cellWidth: 40 } }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });
    }

    doc.save(`Expense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};


// --- Utility Functions ---

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
};

// --- Main App Component ---

function App() {
    const [view, setView] = useState('login'); 
    const [user, setUser] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [initError, setInitError] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [selectedExpenseIdForEdit, setSelectedExpenseIdForEdit] = useState(null);
    const [preselectedCategory, setPreselectedCategory] = useState(null);

    // Initialize Firebase
    useEffect(() => {
        try {
            const config = getFirebaseConfig();
            if (!config) {
                throw new Error("Firebase config not found. Please check your .env file or environment variables.");
            }

            const app = initializeApp(config);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const initAuth = async () => {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                    }
                } catch (error) {
                    console.error("Auth error:", error);
                }
            };

            initAuth();

            const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
                setUser(currentUser);
                if (currentUser) {
                    setCurrentUserId(currentUser.uid);
                    if (view === 'login') setView('viewExpenses');
                } else {
                    setCurrentUserId(null);
                    setView('login');
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            setInitError(error.message);
            setIsAuthReady(true); 
        }
    }, []);

    // Initial Data Setup (Preserved from Old Project)
    useEffect(() => {
        const setupInitialMembers = async () => {
            if (db && isAuthReady && currentUserId) {
                const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
                try {
                    for (const member of flatMembers) {
                        const memberDocRef = doc(membersCollectionRef, member.id);
                        const memberSnap = await getDoc(memberDocRef);

                        if (!memberSnap.exists()) {
                            await setDoc(memberDocRef, {
                                id: member.id,
                                name: member.name,
                                totalDeposited: 0,
                                totalPaid: 0,
                                totalGymDeposited: 0,
                                totalGymPaid: 0,
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error setting up initial members:", error);
                }
            }
        };
        setupInitialMembers();
    }, [db, isAuthReady, currentUserId]);

    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            setUser(null);
            setView('login');
        }
    };

    const navigateToEditExpense = (expenseId) => {
        setSelectedExpenseIdForEdit(expenseId);
        setPreselectedCategory(null);
        setView('addExpense');
    };

    const clearSelectedExpenseForEdit = () => {
        setSelectedExpenseIdForEdit(null);
        setPreselectedCategory(null);
    };

    if (!isAuthReady) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="animate-spin text-white w-8 h-8" /></div>;

    if (initError) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-red-900/20 border border-red-500 rounded-xl p-6 max-w-md w-full text-center">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Initialization Failed</h2>
                    <p className="text-red-300 text-sm mb-4">{initError}</p>
                    <p className="text-gray-400 text-xs">
                        If running locally, ensure you have created a <code>.env</code> file with your Firebase keys (starts with <code>REACT_APP_</code> or <code>VITE_</code>).
                    </p>
                </div>
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={{ db, auth, currentUserId, appId }}>
            {user ? (
                <AppLayout 
                    view={view} 
                    setView={setView} 
                    handleLogout={handleLogout}
                    clearSelectedExpenseForEdit={clearSelectedExpenseForEdit}
                >
                    {view === 'addExpense' && <AddExpenseDashboard selectedExpenseIdForEdit={selectedExpenseIdForEdit} clearSelectedExpenseForEdit={clearSelectedExpenseForEdit} preselectedCategory={preselectedCategory} setView={setView} />}
                    {view === 'viewExpenses' && <ViewExpensesDashboard setView={setView} navigateToEditExpense={navigateToEditExpense} />}
                    {view === 'balances' && <BalancesDashboard />}
                    {view === 'analysis' && <SpendingAnalysisView />}
                    {view === 'generateReport' && <GenerateReportDashboard />}
                </AppLayout>
            ) : (
                <LoginDashboard setUser={setUser} />
            )}
        </FirebaseContext.Provider>
    );
}

// --- Layout Component (UI Structure from New Project) ---

const AppLayout = ({ view, setView, handleLogout, clearSelectedExpenseForEdit, children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const navItems = [
        { id: 'viewExpenses', label: 'Expenses', icon: Receipt },
        { id: 'addExpense', label: 'Add Expense', icon: Plus },
        { id: 'balances', label: 'Balances', icon: Wallet },
        { id: 'analysis', label: 'Spending Analysis', icon: BrainCircuit },
        { id: 'generateReport', label: 'Report', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gray-950 text-white flex overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 flex flex-col`}>
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h1 className="font-bold text-xl text-teal-400">ExpenseTracker</h1>
                    <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5"/></button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(i => (
                        <button 
                            key={i.id} 
                            onClick={() => { 
                                setView(i.id); 
                                if (i.id === 'addExpense') clearSelectedExpenseForEdit();
                                setIsSidebarOpen(false); 
                            }} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === i.id ? 'bg-teal-600/10 text-teal-400 border border-teal-500/20' : 'text-gray-400 hover:bg-gray-800'}`}
                        >
                            <i.icon className="w-5 h-5"/>
                            <span>{i.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-800">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-lg transition-colors">
                        <LogOut className="w-4 h-4"/> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-950">
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 lg:hidden bg-gray-900">
                    <span className="font-bold text-lg">Menu</span>
                    <button onClick={() => setIsSidebarOpen(true)}><Menu className="w-6 h-6 text-gray-400"/></button>
                </header>
                <div className="flex-1 overflow-auto p-4 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

// --- Components (Reskinned) ---

function LoginDashboard({ setUser }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const { auth } = useContext(FirebaseContext);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        if (!auth) { setError("Firebase Auth not initialized. Check configuration."); setLoading(false); return; }
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setUser(auth.currentUser);
        } catch (err) {
            setError("Invalid username or password.");
        } finally { setLoading(false); }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            setUser(auth.currentUser);
        } catch (err) {
            setError("Failed to create account. Email may be in use.");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
            <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-lg p-8 rounded-2xl border border-gray-700 shadow-2xl">
                <h2 className="text-3xl font-bold text-center mb-6 text-teal-400">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
                {error && <div className="bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
                <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                        <input type="email" placeholder="Email Address" className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 focus:border-teal-500 outline-none transition-colors" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                        <input type="password" placeholder="Password" className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 focus:border-teal-500 outline-none transition-colors" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition-colors">
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-gray-400">
                    {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-teal-400 font-semibold hover:text-teal-300">{isSignUp ? "Sign In" : "Sign Up"}</button>
                </div>
            </div>
        </div>
    );
}

function AddExpenseDashboard({ selectedExpenseIdForEdit, clearSelectedExpenseForEdit, preselectedCategory, setView }) {
    const { db, appId } = useContext(FirebaseContext);
    const [itemName, setItemName] = useState('');
    const [cost, setCost] = useState('');
    const [category, setCategory] = useState('Food');
    const [date, setDate] = useState(formatDate(new Date()));
    const [buyerId, setBuyerId] = useState(flatMembers[0].id);
    const [sharedWith, setSharedWith] = useState([]); 
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [currentExpenseId, setCurrentExpenseId] = useState(null);

    const categories = ['Food', 'Cleaning', 'Transport', 'Utilities', 'Rent', 'Other', 'GYM'];
    const gymMembers = flatMembers.filter(member => member.id === 'karthik' || member.id === 'shiva');

    const loadExpenseForEdit = useCallback(async (expenseId) => {
        if (!db) return;
        try {
            const expenseDocRef = doc(db, `artifacts/${appId}/public/data/expenses`, expenseId);
            const expenseSnap = await getDoc(expenseDocRef);
            if (expenseSnap.exists()) {
                const data = expenseSnap.data();
                setItemName(data.itemName);
                setCost(data.cost);
                setCategory(data.category);
                setDate(formatDate(data.date.toDate()));
                setBuyerId(data.buyerId);
                setSharedWith(data.sharedWith);
                setIsEditing(true);
                setCurrentExpenseId(expenseId);
            } 
        } catch (error) { console.error(error); }
    }, [db, appId]);

    useEffect(() => {
        if (selectedExpenseIdForEdit) {
            loadExpenseForEdit(selectedExpenseIdForEdit);
        } else {
            setCategory(preselectedCategory || 'Food');
            setSharedWith([]);
            setItemName('');
            setCost('');
            setDate(formatDate(new Date()));
            setBuyerId(flatMembers[0].id);
            setIsEditing(false);
            setCurrentExpenseId(null);
            setMessage('');
        }
    }, [selectedExpenseIdForEdit, preselectedCategory, loadExpenseForEdit]);

    const handleCategoryChange = (e) => {
        const selectedCat = e.target.value;
        setCategory(selectedCat);
        setSharedWith([]); 
        if (selectedCat === 'GYM') setBuyerId(gymMembers[0].id);
        else setBuyerId(flatMembers[0].id);
    };

    const handleSharedWithChange = (memberId) => {
        setSharedWith(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
    };

    // Logic Helper for Impact (Preserved)
    const applyExpenseImpact = async ({ cost: expenseCost, buyerId: expenseBuyerId, sharedWith: expenseSharedWith, splitAmount, isGymExpense }) => {
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        for (const memberId of expenseSharedWith) {
            const memberDocRef = doc(membersCollectionRef, memberId);
            const memberSnap = await getDoc(memberDocRef);
            let currentData = memberSnap.exists() ? memberSnap.data() : { totalDeposited: 0, totalPaid: 0, totalGymDeposited: 0, totalGymPaid: 0 };
            const updateFields = {};
            if (isGymExpense) updateFields.totalGymPaid = (currentData.totalGymPaid || 0) + splitAmount;
            else updateFields.totalPaid = (currentData.totalPaid || 0) + splitAmount;
            if (!memberSnap.exists()) await setDoc(memberDocRef, { id: memberId, name: flatMembers.find(m => m.id === memberId)?.name || memberId, ...currentData, ...updateFields });
            else await updateDoc(memberDocRef, updateFields);
        }
        const buyerDocRef = doc(membersCollectionRef, expenseBuyerId);
        const buyerSnap = await getDoc(buyerDocRef);
        let buyerCurrentData = buyerSnap.exists() ? buyerSnap.data() : { totalDeposited: 0, totalPaid: 0, totalGymDeposited: 0, totalGymPaid: 0 };
        const updateBuyerFields = {};
        if (isGymExpense) updateBuyerFields.totalGymDeposited = (buyerCurrentData.totalGymDeposited || 0) + expenseCost;
        if (!buyerSnap.exists()) await setDoc(buyerDocRef, { id: expenseBuyerId, name: flatMembers.find(m => m.id === expenseBuyerId)?.name || expenseBuyerId, ...buyerCurrentData, ...updateBuyerFields });
        else if (Object.keys(updateBuyerFields).length > 0) await updateDoc(buyerDocRef, updateBuyerFields);
    };

    const reverseExpenseImpact = async (expenseData) => {
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        const { cost, buyerId, sharedWith: expenseSharedWith, splitAmount, isGymExpense } = expenseData;
        for (const memberId of expenseSharedWith) {
            const memberDocRef = doc(membersCollectionRef, memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (memberSnap.exists()) {
                const currentData = memberSnap.data();
                const updateFields = {};
                if (isGymExpense) updateFields.totalGymPaid = Math.max(0, (currentData.totalGymPaid || 0) - splitAmount);
                else updateFields.totalPaid = Math.max(0, (currentData.totalPaid || 0) - splitAmount);
                await updateDoc(memberDocRef, updateFields);
            }
        }
        const buyerDocRef = doc(membersCollectionRef, buyerId);
        const buyerSnap = await getDoc(buyerDocRef);
        if (buyerSnap.exists()) {
            const buyerCurrentData = buyerSnap.data();
            const updateBuyerFields = {};
            if (isGymExpense) updateBuyerFields.totalGymDeposited = Math.max(0, (buyerCurrentData.totalGymDeposited || 0) - cost);
            if (Object.keys(updateBuyerFields).length > 0) await updateDoc(buyerDocRef, updateBuyerFields);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!db) return;
        const numericCost = parseFloat(cost);
        if (isNaN(numericCost) || numericCost <= 0) { setMessage('Enter valid cost.'); return; }
        if (sharedWith.length === 0) { setMessage('Select shared members.'); return; }

        const splitAmount = numericCost / sharedWith.length;
        const isGymExpense = category === 'GYM';

        try {
            if (isEditing && currentExpenseId) {
                const oldExpenseDocRef = doc(db, `artifacts/${appId}/public/data/expenses`, currentExpenseId);
                const oldExpenseSnap = await getDoc(oldExpenseDocRef);
                if (oldExpenseSnap.exists()) {
                    await reverseExpenseImpact(oldExpenseSnap.data());
                    await applyExpenseImpact({ cost: numericCost, buyerId, sharedWith, splitAmount, isGymExpense });
                    await updateDoc(oldExpenseDocRef, { itemName, cost: numericCost, category, date: new Date(date), buyerId, sharedWith, splitAmount, isGymExpense });
                    setMessage('Updated successfully!');
                }
            } else {
                await applyExpenseImpact({ cost: numericCost, buyerId, sharedWith, splitAmount, isGymExpense });
                await addDoc(collection(db, `artifacts/${appId}/public/data/expenses`), { itemName, cost: numericCost, category, date: new Date(date), buyerId, sharedWith, splitAmount, isGymExpense });
                setMessage('Added successfully!');
            }
            // Reset
            setItemName(''); setCost(''); setCategory('Food'); setDate(formatDate(new Date())); setBuyerId(flatMembers[0].id); setSharedWith([]); setIsEditing(false); setCurrentExpenseId(null); clearSelectedExpenseForEdit();
            setTimeout(() => setView('viewExpenses'), 1000);
        } catch (error) { setMessage(error.message); }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-teal-400 flex items-center gap-2">
                {isEditing ? <Edit2 className="w-6 h-6"/> : <Plus className="w-6 h-6"/>}
                {isEditing ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm text-gray-400 mb-1">Item Name</label>
                            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none" placeholder="e.g. Groceries" required />
                         </div>
                         <div>
                            <label className="block text-sm text-gray-400 mb-1">Cost (₹)</label>
                            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none" placeholder="0.00" step="0.01" required />
                         </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Category</label>
                            <select value={category} onChange={handleCategoryChange} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none">
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Date</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none" required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">{category === 'GYM' ? 'GYM Contributor' : 'Paid By'}</label>
                        <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none">
                            {(category === 'GYM' ? gymMembers : flatMembers).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Split Between:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(category === 'GYM' ? gymMembers : flatMembers).map(member => (
                                <label key={member.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${sharedWith.includes(member.id) ? 'bg-teal-900/30 border-teal-500' : 'bg-gray-900 border-gray-600 hover:border-gray-500'}`}>
                                    <input type="checkbox" checked={sharedWith.includes(member.id)} onChange={() => handleSharedWithChange(member.id)} className="accent-teal-500 w-4 h-4"/>
                                    <span className="text-sm">{member.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {message && <div className={`p-3 rounded-lg text-sm text-center ${message.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{message}</div>}
                    <button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors">
                        {isEditing ? 'Update Expense' : 'Add Expense'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ViewExpensesDashboard({ setView, navigateToEditExpense }) {
    const { db, appId } = useContext(FirebaseContext);
    const [expenses, setExpenses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!db) return;
        const q = collection(db, `artifacts/${appId}/public/data/expenses`);
        return onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate() }));
            data.sort((a, b) => b.date.getTime() - a.date.getTime());
            setExpenses(data);
        });
    }, [db, appId]);

    const handleDelete = async (expenseId) => {
        if (!window.confirm("Delete this expense? This cannot be undone.")) return;
        try {
            const docRef = doc(db, `artifacts/${appId}/public/data/expenses`, expenseId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const expenseData = snap.data();
                const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
                
                // Robust extraction
                const cost = Number(expenseData.cost) || 0;
                const buyerId = expenseData.buyerId;
                const sharedWith = Array.isArray(expenseData.sharedWith) ? expenseData.sharedWith : [];
                const isGymExpense = !!expenseData.isGymExpense;
                
                // Recalculate split if missing to be safe
                let splitAmount = Number(expenseData.splitAmount);
                if ((!splitAmount || isNaN(splitAmount)) && sharedWith.length > 0) {
                    splitAmount = cost / sharedWith.length;
                }
                splitAmount = splitAmount || 0; // fallback to 0

                // Reversal logic
                if (sharedWith.length > 0) {
                    for (const memberId of sharedWith) {
                        if (!memberId) continue;
                        const mRef = doc(membersCollectionRef, memberId);
                        const mSnap = await getDoc(mRef);
                        if (mSnap.exists()) {
                            const d = mSnap.data();
                            const currentPaid = isGymExpense ? (d.totalGymPaid || 0) : (d.totalPaid || 0);
                            const newPaid = Math.max(0, currentPaid - splitAmount);
                            
                            const up = isGymExpense ? { totalGymPaid: newPaid } : { totalPaid: newPaid };
                            await updateDoc(mRef, up);
                        }
                    }
                }

                if (buyerId) {
                    const bRef = doc(membersCollectionRef, buyerId);
                    const bSnap = await getDoc(bRef);
                    if (bSnap.exists()) {
                        const d = bSnap.data();
                        if (isGymExpense) {
                             const currentDep = d.totalGymDeposited || 0;
                             await updateDoc(bRef, { totalGymDeposited: Math.max(0, currentDep - cost) });
                        }
                    }
                }

                await deleteDoc(docRef);
                setMessage('Expense deleted.');
            }
        } catch (e) { 
            console.error("Delete failed: ", e);
            setMessage(`Delete failed: ${e.message}`); 
        }
    };

    const displayedExpenses = expenses.filter(e => e.itemName.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Receipt className="w-6 h-6 text-teal-400"/> Expenses Log</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input type="text" placeholder="Search items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-teal-500 outline-none w-64" />
                </div>
            </div>
            {message && <div className="mb-4 text-teal-400 text-sm">{message}</div>}
            
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900 text-gray-400 uppercase font-medium">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Buyer</th>
                                <th className="p-4">Item</th>
                                <th className="p-4">Cat</th>
                                <th className="p-4">Cost</th>
                                <th className="p-4">Shared With</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {displayedExpenses.map(ex => (
                                <tr key={ex.id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 text-gray-300 whitespace-nowrap">{formatDate(ex.date)}</td>
                                    <td className="p-4 text-teal-400 font-medium">{flatMembers.find(m=>m.id===ex.buyerId)?.name}</td>
                                    <td className="p-4 font-bold text-white">{ex.itemName}</td>
                                    <td className="p-4"><span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">{ex.category}</span></td>
                                    <td className="p-4 font-bold text-white">{formatCurrency(ex.cost)}</td>
                                    <td className="p-4 text-xs text-gray-400 max-w-xs truncate">{ex.sharedWith.map(id => flatMembers.find(m=>m.id===id)?.name).join(', ')}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => navigateToEditExpense(ex.id)} className="text-blue-400 hover:text-blue-300 mr-3"><Edit2 className="w-4 h-4 inline"/></button>
                                        <button onClick={() => handleDelete(ex.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4 inline"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function BalancesDashboard() {
    const { db, appId } = useContext(FirebaseContext);
    const [membersBalances, setMembersBalances] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState(flatMembers[0].id);
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    
    // New State for Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [editMemberId, setEditMemberId] = useState(null);
    const [editField, setEditField] = useState(null); // 'totalDeposited' or 'totalPaid'
    const [editValue, setEditValue] = useState('');
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyMember, setHistoryMember] = useState(null);
    const [contributionHistory, setContributionHistory] = useState([]);

    useEffect(() => {
        if (!db) return;
        return onSnapshot(collection(db, `artifacts/${appId}/public/data/members`), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data(), currentBalance: (d.data().totalDeposited || 0) - (d.data().totalPaid || 0) }));
            setMembersBalances(flatMembers.map(fm => data.find(d => d.id === fm.id) || { ...fm, totalDeposited: 0, totalPaid: 0, currentBalance: 0 }));
        });
    }, [db, appId]);

    const handleTopUp = async () => {
        if (!amount || isNaN(amount)) return;
        try {
            const ref = doc(db, `artifacts/${appId}/public/data/members`, selectedMemberId);
            const snap = await getDoc(ref);
            const current = snap.exists() ? (snap.data().totalDeposited || 0) : 0;
            if(!snap.exists()) await setDoc(ref, { id: selectedMemberId, name: flatMembers.find(m=>m.id===selectedMemberId).name, totalDeposited: 0, totalPaid: 0 });
            await updateDoc(ref, { totalDeposited: current + parseFloat(amount) });
            await addDoc(collection(db, `artifacts/${appId}/public/data/contributions`), { memberId: selectedMemberId, amount: parseFloat(amount), date: new Date(), description: 'Manual Top-up', tags: ['manual'] });
            setMessage('Top-up successful!'); setAmount('');
        } catch (e) { setMessage(e.message); }
    };

    const handleEditClick = (member, field) => {
        setEditMemberId(member.id);
        setEditField(field);
        setEditValue(member[field]);
        setShowEditModal(true);
    };

    const handleEditSubmit = async () => {
        if (!editValue || isNaN(editValue)) return;
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/members`, editMemberId), { [editField]: parseFloat(editValue) });
            setShowEditModal(false);
            setMessage('Balance updated.');
        } catch (e) { setMessage(e.message); }
    };

    const handleHistoryClick = async (member) => {
        setHistoryMember(member);
        const q = query(collection(db, `artifacts/${appId}/public/data/contributions`), where("memberId", "==", member.id));
        const snap = await getDocs(q);
        const history = snap.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date.toDate() })).sort((a,b) => b.date - a.date);
        setContributionHistory(history);
        setShowHistoryModal(true);
    };

    const totalPos = membersBalances.reduce((acc, m) => acc + (m.currentBalance > 0 ? m.currentBalance : 0), 0);
    const totalNeg = membersBalances.reduce((acc, m) => acc + (m.currentBalance < 0 ? m.currentBalance : 0), 0);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Wallet className="w-6 h-6 text-teal-400"/> Balances</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center">
                    <div className="text-gray-400 text-sm mb-1">Total Positive</div>
                    <div className="text-3xl font-bold text-green-400">{formatCurrency(totalPos)}</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center">
                    <div className="text-gray-400 text-sm mb-1">Total Negative</div>
                    <div className="text-3xl font-bold text-red-400">{formatCurrency(totalNeg)}</div>
                </div>
            </div>

            {/* Manual Top Up */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 text-teal-400">Manual Top-Up</h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-sm text-gray-400 mb-1 block">Member</label>
                        <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white">
                            {flatMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-sm text-gray-400 mb-1 block">Amount (₹)</label>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white" placeholder="1000" />
                    </div>
                    <button onClick={handleTopUp} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 px-6 rounded-lg w-full md:w-auto">Add Funds</button>
                </div>
                {message && <div className="mt-2 text-green-400 text-sm">{message}</div>}
            </div>

            {/* Balances Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900 text-gray-400 uppercase font-medium">
                            <tr>
                                <th className="p-4">Member</th>
                                <th className="p-4 text-right">Deposited</th>
                                <th className="p-4 text-right">Paid Share</th>
                                <th className="p-4 text-right">Net Balance</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {membersBalances.map(m => (
                                <tr key={m.id} className="hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 font-bold text-white">{m.name}</td>
                                    <td className="p-4 text-right text-gray-300">{formatCurrency(m.totalDeposited)}</td>
                                    <td className="p-4 text-right text-gray-300">{formatCurrency(m.totalPaid)}</td>
                                    <td className={`p-4 text-right font-bold ${m.currentBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(m.currentBalance)}</td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => handleEditClick(m, 'totalDeposited')} title="Edit Deposited" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-blue-400 transition-colors">
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => handleEditClick(m, 'totalPaid')} title="Edit Paid Share" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-teal-400 transition-colors">
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => handleHistoryClick(m)} title="View History" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-purple-400 transition-colors">
                                            <History className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full border border-gray-700 animate-fade-in-up">
                        <h3 className="text-lg font-bold text-white mb-4">
                            Edit {editField === 'totalDeposited' ? 'Deposited' : 'Paid Share'}
                        </h3>
                        <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-teal-500 outline-none mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleEditSubmit} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg font-bold">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border border-gray-700 animate-fade-in-up max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">{historyMember?.name}'s Contributions</h3>
                            <button onClick={() => setShowHistoryModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-white"/></button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {contributionHistory.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No history found.</p>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-900 text-gray-400">
                                        <tr><th className="p-3">Date</th><th className="p-3">Amount</th><th className="p-3">Note</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {contributionHistory.map(h => (
                                            <tr key={h.id} className="text-gray-300">
                                                <td className="p-3">{formatDate(h.date)}</td>
                                                <td className="p-3 text-teal-400 font-bold">{formatCurrency(h.amount)}</td>
                                                <td className="p-3 text-xs">{h.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const SpendingAnalysisView = () => {
  const { db, appId } = useContext(FirebaseContext);
  const [expenses, setExpenses] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ start: '', end: '' });

  useEffect(() => {
    // Set default range to current month
    const d = new Date();
    d.setDate(1);
    setRange({ start: d.toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = collection(db, `artifacts/${appId}/public/data/expenses`);
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate() }));
        setExpenses(data);
    });
  }, [db, appId]);

  const filteredExpenses = useMemo(() => {
    if (!range.start || !range.end) return [];
    const start = new Date(range.start); start.setHours(0,0,0,0);
    const end = new Date(range.end); end.setHours(23,59,59,999);
    return expenses.filter(e => e.date >= start && e.date <= end);
  }, [expenses, range]);

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + (e.cost || 0), 0);

  // Charts Data
  const catData = useMemo(() => {
      const map = {};
      filteredExpenses.forEach(e => map[e.category] = (map[e.category] || 0) + e.cost);
      return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredExpenses]);

  const monthlyData = useMemo(() => {
      const map = {};
      filteredExpenses.forEach(e => {
          const k = `${e.date.getDate()} ${e.date.toLocaleString('default',{month:'short'})}`;
          map[k] = (map[k] || 0) + e.cost;
      });
      return Object.keys(map).map(k => ({ name: k, amount: map[k] })).slice(0, 15);
  }, [filteredExpenses]);

  const memberData = useMemo(() => {
      const map = {};
      filteredExpenses.forEach(e => {
          const name = flatMembers.find(m => m.id === e.buyerId)?.name || e.buyerId;
          map[name] = (map[name] || 0) + e.cost;
      });
      return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredExpenses]);

  const generateInsight = async () => {
      setLoading(true);
      try {
          const summary = filteredExpenses.slice(0, 30).map(e => `${e.itemName}: ${e.cost}`).join(', ');
          if (!summary) throw new Error("No data to analyze.");
          const text = await generateGeminiResponse(`Analyze spending: [${summary}]. 3 bullet points. No markdown.`);
          setInsight(text);
      } catch (e) { setInsight(`AI Error: ${e.message}`); }
      setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white"><BrainCircuit className="w-8 h-8 text-teal-400" /> Spending Analysis</h1>
      </div>
      
      <div className="flex gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700">
          <input type="date" value={range.start} onChange={e => setRange({...range, start: e.target.value})} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"/>
          <input type="date" value={range.end} onChange={e => setRange({...range, end: e.target.value})} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"/>
          <button onClick={generateInsight} className="bg-teal-900/50 text-teal-400 border border-teal-500/50 px-4 py-2 rounded-lg text-sm hover:bg-teal-900 transition-colors">
              {loading ? <Loader2 className="animate-spin w-4 h-4"/> : "Analyze Range with AI"}
          </button>
      </div>

      <div className="bg-gray-900/50 p-4 rounded-xl space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <p className="text-xs text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <p className="text-xs text-gray-400">Transactions</p>
                <p className="text-2xl font-bold text-white">{filteredExpenses.length}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 col-span-2 h-64">
                <h3 className="text-gray-400 text-xs mb-2">Daily Trend</h3>
                <ResponsiveContainer>
                    <AreaChart data={monthlyData}>
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={10}/>
                        <YAxis stroke="#9ca3af" fontSize={10}/>
                        <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', color: '#fff'}}/>
                        <Area type="monotone" dataKey="amount" stroke="#00897B" fill="#00897B" fillOpacity={0.3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-64">
                <h3 className="text-gray-400 text-xs mb-2">Category Split</h3>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={catData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                            {catData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', color: '#fff'}}/>
                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-64">
            <h3 className="text-gray-400 text-xs mb-2">Member Spending</h3>
            <ResponsiveContainer>
                <BarChart data={memberData}>
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={10}/>
                    <Tooltip cursor={{fill:'transparent'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', color: '#fff'}}/>
                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}/>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-teal-900/20 border border-teal-500/30 p-6 rounded-2xl">
        <h3 className="text-lg font-bold mb-2 text-teal-300">AI Insights</h3>
        <p className="whitespace-pre-wrap text-gray-300">
            {insight || "Click 'Analyze Range with AI' to generate insights about your spending habits."}
        </p>
      </div>
    </div>
  );
};

function GenerateReportDashboard() {
    const { db, appId } = useContext(FirebaseContext);
    const [range, setRange] = useState({ start: '', end: '' });
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        try {
            const start = new Date(range.start);
            const end = new Date(range.end); end.setDate(end.getDate() + 1); // Inclusive
            
            const qExp = query(collection(db, `artifacts/${appId}/public/data/expenses`), where('date', '>=', start), where('date', '<', end));
            const snapExp = await getDocs(qExp);
            const expenses = snapExp.docs.map(d => ({ ...d.data(), id: d.id, date: d.data().date.toDate() }));
            
            const total = expenses.reduce((a,b) => a + b.cost, 0);
            setReportData({ total, count: expenses.length, expenses });
        } catch (e) { alert(e.message); }
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><FileText className="w-6 h-6 text-teal-400"/> Report Generator</h2>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex gap-4 items-end">
                <div className="flex-1"><label className="text-gray-400 text-xs mb-1 block">Start Date</label><input type="date" value={range.start} onChange={e => setRange({...range, start: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"/></div>
                <div className="flex-1"><label className="text-gray-400 text-xs mb-1 block">End Date</label><input type="date" value={range.end} onChange={e => setRange({...range, end: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"/></div>
                <button onClick={generate} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded h-[42px]">{loading ? '...' : 'Generate'}</button>
            </div>

            {reportData && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white">Report Summary</h3>
                        <button 
                            onClick={() => generateReportPDF(reportData.expenses, range.start, range.end)} 
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-colors"
                        >
                            <Download className="w-4 h-4"/> Download PDF
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-900 p-4 rounded border border-gray-700 text-center">
                            <div className="text-gray-400 text-sm">Total Spent</div>
                            <div className="text-2xl font-bold text-teal-400">{formatCurrency(reportData.total)}</div>
                        </div>
                        <div className="bg-gray-900 p-4 rounded border border-gray-700 text-center">
                            <div className="text-gray-400 text-sm">Transactions</div>
                            <div className="text-2xl font-bold text-white">{reportData.count}</div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-900 text-gray-500"><tr><th className="p-3">Date</th><th className="p-3">Item</th><th className="p-3 text-right">Cost</th></tr></thead>
                            <tbody className="divide-y divide-gray-700">
                                {reportData.expenses.map(e => (
                                    <tr key={e.id} className="text-gray-300">
                                        <td className="p-3">{formatDate(e.date)}</td>
                                        <td className="p-3">{e.itemName}</td>
                                        <td className="p-3 text-right font-bold">{formatCurrency(e.cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;