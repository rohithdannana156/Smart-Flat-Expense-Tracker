/* global __app_id, __firebase_config, __initial_auth_token */
// The report will now be displayed directly in the UI, removing PDF generation dependencies.


import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithCustomToken, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';


/// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Load Firebase config from secure .env file
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase Context to provide Firebase instances to components
const FirebaseContext = createContext(null);

// Hardcoded members for the flat
const flatMembers = [
    { id: 'anudeep', name: 'Anudeep' },
    { id: 'karthik', name: 'Karthik' },
    { id: 'mahesh', name: 'Mahesh' },
    { id: 'rohith', name: 'Rohith' },
    { id: 'shiva', name: 'Shiva' },
];

// Utility function to format date
const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Utility function to format currency
const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
};

// Main App Component
function App() {
    const [view, setView] = useState('login'); // 'login', 'addExpense', 'viewExpenses', 'balances', 'generateReport', 'gymDashboard'
    const [user, setUser] = useState(null); // Firebase authenticated user
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null); // User ID for Firestore paths
    const [selectedExpenseIdForEdit, setSelectedExpenseIdForEdit] = useState(null);
    const [preselectedCategory, setPreselectedCategory] = useState(null);


    // Initialize Firebase and set up authentication listener
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            console.log("Firebase Config used by app:", firebaseConfig);

            const signInUser = async () => {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        console.log("Signed in with custom token.");
                    } else {
                        console.log("No initial auth token. User will log in manually.");
                    }
                } catch (error) {
                    console.error("Firebase authentication error during initial setup:", error);
                }
            };

            signInUser();

            const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
                setUser(currentUser);
                if (currentUser) {
                    setCurrentUserId(currentUser.uid);
                    console.log("Firebase Auth State Changed: User is logged in.", currentUser.uid);
                } else {
                    setCurrentUserId(null);
                    console.log("Firebase Auth State Changed: User is logged out.");
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
        }
    }, []);

    useEffect(() => {
        const setupInitialMembers = async () => {
            if (db && isAuthReady && currentUserId) {
                const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
                try {
                    for (const member of flatMembers) {
                        const memberDocRef = doc(membersCollectionRef, member.id);
                        const memberSnap = await getDoc(memberDocRef);

                        if (!memberSnap.exists()) {
                            console.log(`Initializing new member ${member.name} in Firestore...`);
                            await setDoc(memberDocRef, {
                                id: member.id,
                                name: member.name,
                                totalDeposited: 0,
                                totalPaid: 0,
                                totalGymDeposited: 0,
                                totalGymPaid: 0,
                            });
                        } else {
                            const data = memberSnap.data();
                            const updateData = {};
                            if (data.totalGymDeposited === undefined) updateData.totalGymDeposited = 0;
                            if (data.totalGymPaid === undefined) updateData.totalGymPaid = 0;

                            if (Object.keys(updateData).length > 0) {
                                console.log(`Updating member ${member.name} with new GYM fields.`);
                                await updateDoc(memberDocRef, updateData);
                            }
                        }
                    }
                    console.log("Flat members initialization/update complete.");
                } catch (error) {
                    console.error("Error setting up initial members:", error);
                }
            }
        };
        setupInitialMembers();
    }, [db, isAuthReady, currentUserId]);

    const handleLogout = async () => {
        if (auth) {
            try {
                await signOut(auth);
                setUser(null);
                setView('login');
                console.log("User logged out.");
            } catch (error) {
                console.error("Error logging out:", error);
            }
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

    const navigateToAddGymExpense = () => {
        setPreselectedCategory('GYM');
        setView('addExpense');
    };

    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center animate-pulse">
                    <p className="text-xl font-semibold text-gray-700">Loading application...</p>
                    <p className="text-gray-500 mt-2">Please wait while we set things up.</p>
                </div>
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={{ db, auth, currentUserId, appId }}>
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 font-sans text-gray-800 flex flex-col">
                {user ? (
                    <>
                        <nav className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 shadow-xl">
                            <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                                <h1 className="text-white text-3xl font-extrabold mb-2 sm:mb-0 drop-shadow-md">Smart Expense Tracker</h1>
                                <div className="flex flex-wrap justify-center sm:justify-end gap-2">
                                    <button
                                        onClick={() => { setView('addExpense'); clearSelectedExpenseForEdit(); }}
                                        className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${view === 'addExpense' ? 'bg-white text-emerald-700 shadow-inner' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                    >
                                        Add Expense
                                    </button>
                                    <button
                                        onClick={() => { setView('viewExpenses'); clearSelectedExpenseForEdit(); }}
                                        className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${view === 'viewExpenses' ? 'bg-white text-emerald-700 shadow-inner' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                    >
                                        View Expenses
                                    </button>
                                    <button
                                        onClick={() => { setView('balances'); clearSelectedExpenseForEdit(); }}
                                        className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${view === 'balances' ? 'bg-white text-emerald-700 shadow-inner' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                    >
                                        Balances
                                    </button>
                                    <button
                                        onClick={() => { setView('gymDashboard'); clearSelectedExpenseForEdit(); }}
                                        className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${view === 'gymDashboard' ? 'bg-white text-emerald-700 shadow-inner' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                    >
                                        GYM Dashboard
                                    </button>
                                    <button
                                        onClick={() => { setView('generateReport'); clearSelectedExpenseForEdit(); }}
                                        className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${view === 'generateReport' ? 'bg-white text-emerald-700 shadow-inner' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                                    >
                                        Generate Report
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="px-5 py-2 rounded-full font-semibold text-sm bg-red-600 text-white hover:bg-red-700 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </nav>

                        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                            {view === 'addExpense' && <AddExpenseDashboard selectedExpenseIdForEdit={selectedExpenseIdForEdit} clearSelectedExpenseForEdit={clearSelectedExpenseForEdit} preselectedCategory={preselectedCategory} />}
                            {view === 'viewExpenses' && <ViewExpensesDashboard setView={setView} navigateToEditExpense={navigateToEditExpense} />}
                            {view === 'balances' && <BalancesDashboard />}
                            {view === 'gymDashboard' && <GymDashboard navigateToAddGymExpense={navigateToAddGymExpense} />}
                            {view === 'generateReport' && <GenerateReportDashboard />}
                        </main>
                    </>
                ) : (
                    <LoginDashboard setUser={setUser} />
                )}
            </div>
        </FirebaseContext.Provider>
    );
}

// Login Dashboard Component
function LoginDashboard({ setUser }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const { auth } = useContext(FirebaseContext);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!auth) {
            setError("Firebase Auth not initialized.");
            return;
        }
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setUser(auth.currentUser);
            console.log("Logged in successfully!");
        } catch (err) {
            console.error("Login error:", err);
            setError("Invalid username or password. Please try again.");
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        if (!auth) {
            setError("Firebase Auth not initialized.");
            return;
        }
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            setUser(auth.currentUser);
            console.log("Account created and logged in successfully!");
        } catch (err) {
            console.error("Sign up error:", err);
            let errorMessage = "Failed to create account. Please try again.";
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = "Email already in use. Please log in or use a different email.";
            } else if (err.code === 'auth/weak-password') {
                errorMessage = "Password is too weak. Please use at least 6 characters.";
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address.";
            }
            setError(errorMessage);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-600 to-emerald-700 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-500 hover:scale-[1.02] hover:shadow-3xl animate-fade-in">
                <h2 className="text-4xl font-extrabold text-center text-gray-900 mb-8 tracking-tight">
                    {isSignUp ? 'Create Account' : 'Welcome Back!'}
                </h2>
                <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Username (Email)
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-300 shadow-sm hover:border-emerald-400"
                            placeholder="your@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-300 shadow-sm hover:border-emerald-400"
                            placeholder="********"
                            required
                        />
                    </div>
                    {error && <p className="text-red-600 text-sm text-center font-medium mt-3 animate-bounce-in">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-3 rounded-lg font-semibold text-lg shadow-lg hover:from-emerald-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                    >
                        {isSignUp ? 'Sign Up' : 'Login'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsSignUp(prev => !prev)}
                        className="text-emerald-700 hover:underline text-sm font-medium hover:text-emerald-900 transition-colors duration-200"
                    >
                        {isSignUp ? 'Already have an account? Login' : 'Don\'t have an account? Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Add Expense Dashboard Component
function AddExpenseDashboard({ selectedExpenseIdForEdit, clearSelectedExpenseForEdit, preselectedCategory }) {
    const { db, appId } = useContext(FirebaseContext);
    const [itemName, setItemName] = useState('');
    const [cost, setCost] = useState('');
    const [category, setCategory] = useState('Food');
    const [date, setDate] = useState(formatDate(new Date()));
    const [buyerId, setBuyerId] = useState(flatMembers[0].id);
    const [sharedWith, setSharedWith] = useState([]); // Initialize as empty for manual selection
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
                setMessage('');
            } else {
                setMessage('Expense not found for editing.');
            }
        } catch (error) {
            console.error("Error loading expense for edit:", error);
            setMessage('Error loading expense for edit.');
        }
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
        setSharedWith([]); // Always reset sharedWith when category changes
        if (selectedCat === 'GYM') {
            setBuyerId(gymMembers[0].id); // Default GYM buyer
        } else {
            setBuyerId(flatMembers[0].id); // Default general buyer
        }
    };

    const handleSharedWithChange = (memberId) => {
        setSharedWith(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!db) {
            setMessage('Firebase not initialized.');
            return;
        }

        const numericCost = parseFloat(cost);
        if (isNaN(numericCost) || numericCost <= 0) {
            setMessage('Please enter a valid positive cost.');
            return;
        }
        if (sharedWith.length === 0) {
            setMessage('Please select at least one member to share the expense with.');
            return;
        }

        const splitAmount = numericCost / sharedWith.length;
        const isGymExpense = category === 'GYM';

        try {
            if (isEditing && currentExpenseId) {
                const oldExpenseDocRef = doc(db, `artifacts/${appId}/public/data/expenses`, currentExpenseId);
                const oldExpenseSnap = await getDoc(oldExpenseDocRef);
                if (!oldExpenseSnap.exists()) {
                    setMessage('Original expense not found for update.');
                    return;
                }
                const oldData = oldExpenseSnap.data();

                await reverseExpenseImpact(oldData);
                await applyExpenseImpact({
                    cost: numericCost,
                    buyerId: buyerId,
                    sharedWith: sharedWith,
                    splitAmount: splitAmount,
                    isGymExpense: isGymExpense,
                });

                await updateDoc(oldExpenseDocRef, {
                    itemName,
                    cost: numericCost,
                    category,
                    date: new Date(date),
                    buyerId,
                    sharedWith,
                    splitAmount,
                    isGymExpense: isGymExpense,
                });

                setMessage('Expense updated successfully!');
            } else {
                await applyExpenseImpact({
                    cost: numericCost,
                    buyerId: buyerId,
                    sharedWith: sharedWith,
                    splitAmount: splitAmount,
                    isGymExpense: isGymExpense,
                });

                await addDoc(collection(db, `artifacts/${appId}/public/data/expenses`), {
                    itemName,
                    cost: numericCost,
                    category,
                    date: new Date(date),
                    buyerId,
                    sharedWith,
                    splitAmount,
                    isGymExpense: isGymExpense,
                });
                setMessage('Expense added successfully!');
            }

            setItemName('');
            setCost('');
            setCategory('Food');
            setDate(formatDate(new Date()));
            setBuyerId(flatMembers[0].id);
            setSharedWith([]);
            setIsEditing(false);
            setCurrentExpenseId(null);
            clearSelectedExpenseForEdit();
        } catch (error) {
            console.error("Error adding/updating expense:", error);
            setMessage(`Error: ${error.message}`);
        }
    };

    const applyExpenseImpact = async ({ cost: expenseCost, buyerId: expenseBuyerId, sharedWith: expenseSharedWith, splitAmount, isGymExpense }) => {
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);

        // Update balances for each member involved in sharing
        for (const memberId of expenseSharedWith) {
            const memberDocRef = doc(membersCollectionRef, memberId);
            const memberSnap = await getDoc(memberDocRef);
            let currentData = memberSnap.exists() ? memberSnap.data() : { totalDeposited: 0, totalPaid: 0, totalGymDeposited: 0, totalGymPaid: 0 };

            const updateFields = {};
            if (isGymExpense) {
                // For GYM expense, only update totalGymPaid
                updateFields.totalGymPaid = (currentData.totalGymPaid || 0) + splitAmount;
            } else {
                // For general expense, only update totalPaid
                updateFields.totalPaid = (currentData.totalPaid || 0) + splitAmount;
            }

            if (!memberSnap.exists()) {
                await setDoc(memberDocRef, {
                    id: memberId,
                    name: flatMembers.find(m => m.id === memberId)?.name || memberId,
                    totalDeposited: 0,
                    totalPaid: 0,
                    totalGymDeposited: 0,
                    totalGymPaid: 0,
                    ...currentData, // Keep existing data if it exists
                    ...updateFields // Apply specific updates
                });
            } else {
                await updateDoc(memberDocRef, updateFields);
            }
        }

        // Update balances for the buyer (who paid the full amount)
        const buyerDocRef = doc(membersCollectionRef, expenseBuyerId);
        const buyerSnap = await getDoc(buyerDocRef);
        let buyerCurrentData = buyerSnap.exists() ? buyerSnap.data() : { totalDeposited: 0, totalPaid: 0, totalGymDeposited: 0, totalGymPaid: 0 };

        const updateBuyerFields = {};
        if (isGymExpense) {
            // For GYM expense, update totalGymDeposited for the buyer
            updateBuyerFields.totalGymDeposited = (buyerCurrentData.totalGymDeposited || 0) + expenseCost;
        } else {
            // For general expenses, the buyer's 'totalDeposited' is NOT affected by paying for an expense.
            // It only increases from manual top-ups in BalancesDashboard.
            // So, no update to totalDeposited here for general expenses.
        }

        if (!buyerSnap.exists()) {
            await setDoc(buyerDocRef, {
                id: expenseBuyerId,
                name: flatMembers.find(m => m.id === expenseBuyerId)?.name || expenseBuyerId,
                totalDeposited: 0,
                totalPaid: 0,
                totalGymDeposited: 0,
                totalGymPaid: 0,
                ...buyerCurrentData, // Keep existing data if it exists
                ...updateBuyerFields // Apply specific updates
            });
        } else {
            if (Object.keys(updateBuyerFields).length > 0) {
                await updateDoc(buyerDocRef, updateBuyerFields);
            }
        }
    };

    const reverseExpenseImpact = async (expenseData) => {
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        const { cost, buyerId, sharedWith: expenseSharedWith, splitAmount, isGymExpense } = expenseData;

        // Reverse totalPaid and totalGymPaid for all sharedWith members
        for (const memberId of expenseSharedWith) {
            const memberDocRef = doc(membersCollectionRef, memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (memberSnap.exists()) {
                const currentData = memberSnap.data();
                const updateFields = {};
                if (isGymExpense) {
                    updateFields.totalGymPaid = Math.max(0, (currentData.totalGymPaid || 0) - splitAmount);
                } else {
                    updateFields.totalPaid = Math.max(0, (currentData.totalPaid || 0) - splitAmount);
                }
                await updateDoc(memberDocRef, updateFields);
            }
        }

        // Reverse totalDeposited and totalGymDeposited for the buyer
        const buyerDocRef = doc(membersCollectionRef, buyerId);
        const buyerSnap = await getDoc(buyerDocRef);
        if (buyerSnap.exists()) {
            const buyerCurrentData = buyerSnap.data();
            const updateBuyerFields = {};
            if (isGymExpense) {
                updateBuyerFields.totalGymDeposited = Math.max(0, (buyerCurrentData.totalGymDeposited || 0) - cost);
            } else {
                // For general expenses, the buyer's 'totalDeposited' was NOT increased by paying for an expense.
                // So, no reversal needed for totalDeposited here for general expenses.
            }
            if (Object.keys(updateBuyerFields).length > 0) {
                await updateDoc(buyerDocRef, updateBuyerFields);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto my-8 transform transition-all duration-300 hover:shadow-2xl animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                {isEditing ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1">
                        Item Name
                    </label>
                    <input
                        type="text"
                        id="itemName"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                        placeholder="e.g., Groceries"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-1">
                        Cost (INR)
                    </label>
                    <input
                        type="number"
                        id="cost"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                        placeholder="e.g., 500"
                        step="0.01"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                    </label>
                    <select
                        id="category"
                        value={category}
                        onChange={handleCategoryChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 bg-white transition duration-200 shadow-sm hover:border-emerald-400"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                    </label>
                    <input
                        type="date"
                        id="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="buyer" className="block text-sm font-medium text-gray-700 mb-1">
                        {category === 'GYM' ? 'GYM Contributor' : 'Buyer'}
                    </label>
                    <select
                        id="buyer"
                        value={buyerId}
                        onChange={(e) => setBuyerId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 bg-white transition duration-200 shadow-sm hover:border-emerald-400"
                    >
                        {(category === 'GYM' ? gymMembers : flatMembers).map(member => (
                            <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shared With:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(category === 'GYM' ? gymMembers : flatMembers).map(member => (
                            <label key={member.id} className="inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    value={member.id}
                                    checked={sharedWith.includes(member.id)}
                                    onChange={() => handleSharedWithChange(member.id)}
                                    className="form-checkbox h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500 transition duration-200"
                                />
                                <span className="ml-2 text-gray-700">{member.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                {message && (
                    <div className={`p-3 rounded-lg text-center font-medium mt-3 animate-bounce-in ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}
                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:from-emerald-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                >
                    {isEditing ? 'Update Expense' : 'Add Expense'}
                </button>
                {isEditing && (
                    <button
                        type="button"
                        onClick={() => {
                            setIsEditing(false);
                            setCurrentExpenseId(null);
                            setItemName('');
                            setCost('');
                            setCategory('Food');
                            setDate(formatDate(new Date()));
                            setBuyerId(flatMembers[0].id);
                            setSharedWith(flatMembers.map(m => m.id));
                            setMessage('');
                            clearSelectedExpenseForEdit();
                        }}
                        className="w-full mt-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:from-gray-500 hover:to-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                    >
                        Cancel Edit
                    </button>
                )}
            </form>
        </div>
    );
}

// View Expenses Dashboard Component
function ViewExpensesDashboard({ setView, navigateToEditExpense }) {
    const { db, appId } = useContext(FirebaseContext);
    const [expenses, setExpenses] = useState([]);
    const [message, setMessage] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredExpenses = expenses.filter(expense =>
        expense.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (!db) return;

        const expensesCollectionRef = collection(db, `artifacts/${appId}/public/data/expenses`);
        const unsubscribe = onSnapshot(expensesCollectionRef, (snapshot) => {
            const expensesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            }));
            expensesData.sort((a, b) => b.date.getTime() - a.date.getTime());
            setExpenses(expensesData);
        }, (error) => {
            console.error("Error fetching expenses:", error);
            setMessage("Error fetching expenses. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    const reverseExpenseImpact = async (expenseData) => {
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        const { cost, buyerId, sharedWith: expenseSharedWith, splitAmount, isGymExpense } = expenseData;

        for (const memberId of expenseSharedWith) {
            const memberDocRef = doc(membersCollectionRef, memberId);
            const memberSnap = await getDoc(memberDocRef);
            if (memberSnap.exists()) {
                const currentData = memberSnap.data();
                const updateFields = {};
                if (isGymExpense) {
                    updateFields.totalGymPaid = Math.max(0, (currentData.totalGymPaid || 0) - splitAmount);
                } else {
                    updateFields.totalPaid = Math.max(0, (currentData.totalPaid || 0) - splitAmount);
                }
                await updateDoc(memberDocRef, updateFields);
            }
        }

        const buyerDocRef = doc(membersCollectionRef, buyerId); // Define buyerDocRef here
        const paidBySnap = await getDoc(buyerDocRef);
        if (paidBySnap.exists()) {
            const buyerCurrentData = paidBySnap.data();
            const updateBuyerFields = {};
            if (isGymExpense) {
                updateBuyerFields.totalGymDeposited = Math.max(0, (buyerCurrentData.totalGymDeposited || 0) - cost);
            } else {
                // For general expenses, the buyer's 'totalDeposited' was NOT increased by paying for an expense.
                // So, no reversal needed for totalDeposited here for general expenses.
            }
            if (Object.keys(updateBuyerFields).length > 0) {
                await updateDoc(buyerDocRef, updateBuyerFields);
            }
        }
    };

    const handleDelete = async (expenseId) => {
        setExpenseToDelete(expenseId);
        setShowConfirmModal(true);
    };

    const confirmDelete = async () => {
        if (!db || !expenseToDelete) return;

        try {
            const expenseDocRef = doc(db, `artifacts/${appId}/public/data/expenses`, expenseToDelete);
            const expenseSnap = await getDoc(expenseDocRef);

            if (expenseSnap.exists()) {
                const expenseData = expenseSnap.data();
                await reverseExpenseImpact(expenseData);
                await deleteDoc(expenseDocRef);
                setMessage('Expense deleted successfully!');
            } else {
                setMessage('Expense not found.');
            }
        } catch (error) {
            console.error("Error deleting expense:", error);
            setMessage(`Error deleting expense: ${error.message}`);
        } finally {
            setShowConfirmModal(false);
            setExpenseToDelete(null);
        }
    };

    const handleEdit = (expenseId) => {
        navigateToEditExpense(expenseId);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl mx-auto my-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">All Expenses</h2>

            <div className="mb-6">
                <label htmlFor="searchItem" className="block text-sm font-medium text-gray-700 mb-1">
                    Search by Item Name
                </label>
                <input
                    type="text"
                    id="searchItem"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                    placeholder="e.g., Groceries, Electricity"
                />
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-center font-medium mb-4 animate-bounce-in ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}
            {filteredExpenses.length === 0 && expenses.length > 0 && searchTerm !== '' ? (
                 <p className="text-center text-gray-500">No matching expenses found.</p>
            ) : filteredExpenses.length === 0 && expenses.length === 0 ? (
                <p className="text-center text-gray-500">No expenses recorded yet.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Buyer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Item Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cost (INR)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Shared With</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-teal-50 hover:shadow-md transition-all duration-200">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(expense.date)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {flatMembers.find(m => m.id === expense.buyerId)?.name || expense.buyerId}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{expense.itemName}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{expense.category}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(expense.cost)}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        {expense.sharedWith.map(id => flatMembers.find(m => m.id === id)?.name || id).join(', ')}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(expense.id)}
                                            className="text-emerald-600 hover:text-emerald-800 hover:scale-110 mr-3 transition-all duration-200"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="text-red-600 hover:text-red-800 hover:scale-110 transition-all duration-200"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100 animate-zoom-in">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
                        <p className="text-gray-700 mb-6">Are you sure you want to delete this expense? This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Balances Dashboard Component
function BalancesDashboard() {
    const { db, appId } = useContext(FirebaseContext);
    const [membersBalances, setMembersBalances] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState(flatMembers[0].id);
    const [contributionAmount, setContributionAmount] = useState('');
    const [message, setMessage] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editField, setEditField] = useState('');
    const [editMemberId, setEditMemberId] = useState('');
    const [editValue, setEditValue] = useState('');
    const [showContributionHistoryModal, setShowContributionHistoryModal] = useState(false);
    const [selectedMemberForHistory, setSelectedMemberForHistory] = useState(null);
    const [memberContributionsHistory, setMemberContributionsHistory] = useState([]);


    useEffect(() => {
        if (!db) return;

        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        const unsubscribe = onSnapshot(membersCollectionRef, (snapshot) => {
            const balancesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                totalDeposited: doc.data().totalDeposited || 0,
                totalPaid: doc.data().totalPaid || 0,
                totalGymDeposited: doc.data().totalGymDeposited || 0,
                totalGymPaid: doc.data().totalGymPaid || 0,
                currentBalance: (doc.data().totalDeposited || 0) - (doc.data().totalPaid || 0),
                currentGymBalance: (doc.data().totalGymDeposited || 0) - (doc.data().totalGymPaid || 0)
            }));
            const fullBalances = flatMembers.map(fm => {
                const existing = balancesData.find(b => b.id === fm.id);
                return existing || { id: fm.id, name: fm.name, totalDeposited: 0, totalPaid: 0, totalGymDeposited: 0, totalGymPaid: 0, currentBalance: 0, currentGymBalance: 0 };
            });
            setMembersBalances(fullBalances);
        }, (error) => {
            console.error("Error fetching members balances:", error);
            setMessage("Error fetching balances. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    const handleAddContribution = async () => {
        setMessage('');
        if (!db) {
            setMessage('Firebase not initialized.');
            return;
        }

        const amount = parseFloat(contributionAmount);
        if (isNaN(amount) || amount <= 0) {
            setMessage('Please enter a valid positive contribution amount.');
            return;
        }

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/members`, selectedMemberId);
            const memberSnap = await getDoc(memberDocRef);

            let currentDeposited = 0;
            if (memberSnap.exists()) {
                currentDeposited = memberSnap.data().totalDeposited || 0;
            } else {
                await setDoc(memberDocRef, {
                    id: selectedMemberId,
                    name: flatMembers.find(m => m.id === selectedMemberId)?.name || selectedMemberId,
                    totalDeposited: 0,
                    totalPaid: 0,
                    totalGymDeposited: 0,
                    totalGymPaid: 0,
                });
            }
            await updateDoc(memberDocRef, { totalDeposited: currentDeposited + amount });

            await addDoc(collection(db, `artifacts/${appId}/public/data/contributions`), {
                memberId: selectedMemberId,
                amount: amount,
                date: new Date(),
                description: `Manual contribution by ${flatMembers.find(m => m.id === selectedMemberId)?.name || selectedMemberId}`,
                tags: ['manual', 'top-up']
            });

            setMessage(`Contribution of ${formatCurrency(amount)} added for ${flatMembers.find(m => m.id === selectedMemberId)?.name || selectedMemberId}.`);
            setContributionAmount('');
        } catch (error) {
            console.error("Error adding contribution:", error);
            setMessage(`Error adding contribution: ${error.message}`);
        }
    };

    const openEditModal = (memberId, field, currentValue) => {
        setEditMemberId(memberId);
        setEditField(field);
        setEditValue(currentValue.toFixed(2));
        setShowEditModal(true);
    };

    const handleEditSubmit = async () => {
        setMessage('');
        if (!db || !editMemberId || !editField) return;

        const newValue = parseFloat(editValue);
        if (isNaN(newValue) || newValue < 0) {
            setMessage('Please enter a valid non-negative amount.');
            return;
        }

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/members`, editMemberId);
            await updateDoc(memberDocRef, { [editField]: newValue });
            setMessage(`${editField === 'totalDeposited' ? 'Deposit' : 'Paid'} updated successfully for ${flatMembers.find(m => m.id === editMemberId)?.name || editMemberId}.`);
            setShowEditModal(false);
            setEditValue('');
            setEditMemberId('');
            setEditField('');
        } catch (error) {
            console.error("Error updating balance field:", error);
            setMessage(`Error updating ${editField}: ${error.message}`);
        }
    };

    const viewContributionHistory = async (memberId) => {
        if (!db) return;
        setSelectedMemberForHistory(flatMembers.find(m => m.id === memberId));
        try {
            const q = query(collection(db, `artifacts/${appId}/public/data/contributions`), where("memberId", "==", memberId));
            const querySnapshot = await getDocs(q);
            const history = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            }));
            history.sort((a, b) => b.date.getTime() - a.date.getTime());
            setMemberContributionsHistory(history);
            setShowContributionHistoryModal(true);
        } catch (error) {
            console.error("Error fetching contribution history:", error);
            setMessage(`Error fetching history: ${error.message}`);
        }
    };

    const totalPositiveBalance = membersBalances.reduce((sum, member) => sum + (member.currentBalance > 0 ? member.currentBalance : 0), 0);
    const totalNegativeBalance = membersBalances.reduce((sum, member) => sum + (member.currentBalance < 0 ? member.currentBalance : 0), 0);


    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl mx-auto my-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Balances Dashboard</h2>

            {/* Total Positive & Negative Balances */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-100 border border-green-300 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-green-700">Total Positive Balance</h3>
                    <p className="text-2xl font-bold text-green-800">{formatCurrency(totalPositiveBalance)}</p>
                </div>
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg shadow-md text-center">
                    <h3 className="text-lg font-semibold text-red-700">Total Negative Balance</h3>
                    <p className="text-2xl font-bold text-red-800">{formatCurrency(totalNegativeBalance)}</p>
                </div>
            </div>

            {/* Top-Up Section */}
            <div className="mb-8 p-5 border border-emerald-300 rounded-lg bg-emerald-50 shadow-md transform transition-all duration-300 hover:shadow-xl">
                <h3 className="text-xl font-semibold text-emerald-700 mb-4">Top-Up Section (General Contributions)</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="selectMember" className="block text-sm font-medium text-gray-700 mb-1">
                            Select Member
                        </label>
                        <select
                            id="selectMember"
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 bg-white transition duration-200 shadow-sm hover:border-emerald-400"
                        >
                            {flatMembers.map(member => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="contributionAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Add Contribution Amount (₹)
                        </label>
                        <input
                            type="number"
                            id="contributionAmount"
                            value={contributionAmount}
                            onChange={(e) => setContributionAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                            placeholder="e.g., 1000"
                            step="0.01"
                            required
                        />
                    </div>
                    <button
                        onClick={handleAddContribution}
                        className="w-full sm:w-auto px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                    >
                        Add My Contribution
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-center font-medium mb-4 animate-bounce-in ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            {/* Balance Summary Table */}
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Balance Summary (All Expenses)</h3>
            {membersBalances.length === 0 ? (
                <p className="text-center text-gray-500">No balance data available yet.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Member</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Deposited (₹)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Paid (₹)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Current Balance (₹)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {membersBalances.map((member) => (
                                <tr key={member.id} className="hover:bg-teal-50 hover:shadow-md transition-all duration-200">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalDeposited)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalPaid)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                        <span className={member.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatCurrency(member.currentBalance)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => openEditModal(member.id, 'totalDeposited', member.totalDeposited)}
                                            className="text-emerald-600 hover:text-emerald-800 hover:scale-110 mr-3 transition-all duration-200"
                                        >
                                            Edit Deposit
                                        </button>
                                        <button
                                            onClick={() => openEditModal(member.id, 'totalPaid', member.totalPaid)}
                                            className="text-teal-600 hover:text-teal-800 hover:scale-110 transition-all duration-200"
                                        >
                                            Edit Paid
                                        </button>
                                        <button
                                            onClick={() => viewContributionHistory(member.id)}
                                            className="text-purple-600 hover:text-purple-800 hover:scale-110 ml-3 transition-all duration-200"
                                        >
                                            History
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100 animate-zoom-in">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Edit {editField === 'totalDeposited' ? 'Total Deposited' : 'Total Paid'} for {flatMembers.find(m => m.id === editMemberId)?.name || editMemberId}
                        </h3>
                        <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 mb-4 transition duration-200 shadow-sm hover:border-emerald-400"
                            step="0.01"
                            required
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSubmit}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors duration-200"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contribution History Modal */}
            {showContributionHistoryModal && selectedMemberForHistory && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full transform transition-all duration-300 scale-100 animate-zoom-in">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                            Contribution History for {selectedMemberForHistory.name}
                        </h3>
                        {memberContributionsHistory.length === 0 ? (
                            <p className="text-center text-gray-500">No contribution history found for this member.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-80">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount (₹)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {memberContributionsHistory.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-teal-50 transition-colors duration-200">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(entry.date)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(entry.amount)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{entry.description || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {(entry.tags && entry.tags.length > 0) ? entry.tags.join(', ') : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setShowContributionHistoryModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// GYM Dashboard Component
function GymDashboard({ navigateToAddGymExpense }) {
    const { db, appId } = useContext(FirebaseContext);
    const [gymExpenses, setGymExpenses] = useState([]);
    const [gymMembersBalances, setGymMembersBalances] = useState([]);
    const [selectedGymMemberId, setSelectedGymMemberId] = useState('karthik');
    const [gymContributionAmount, setGymContributionAmount] = useState('');
    const [message, setMessage] = useState('');
    const [showGymEditModal, setShowGymEditModal] = useState(false);
    const [gymEditField, setGymEditField] = useState('');
    const [gymEditMemberId, setGymEditMemberId] = useState('');
    const [gymEditValue, setGymEditValue] = useState('');
    const [showGymContributionHistoryModal, setShowGymContributionHistoryModal] = useState(false);
    const [selectedGymMemberForHistory, setSelectedGymMemberForHistory] = useState(null);
    const [gymMemberContributionsHistory, setGymMemberContributionsHistory] = useState([]);


    const gymMembers = flatMembers.filter(member => member.id === 'karthik' || member.id === 'shiva');

    // Fetch GYM expenses
    useEffect(() => {
        if (!db) return;

        const expensesCollectionRef = collection(db, `artifacts/${appId}/public/data/expenses`);
        const q = query(expensesCollectionRef, where("isGymExpense", "==", true));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            }));
            expensesData.sort((a, b) => b.date.getTime() - a.date.getTime());
            setGymExpenses(expensesData);
        }, (error) => {
            console.error("Error fetching GYM expenses:", error);
            setMessage("Error fetching GYM expenses. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    // Fetch and update GYM specific balances from member documents
    useEffect(() => {
        if (!db) return;

        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
        const unsubscribe = onSnapshot(membersCollectionRef, (snapshot) => {
            const balancesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                totalGymDeposited: doc.data().totalGymDeposited || 0,
                totalGymPaid: doc.data().totalGymPaid || 0,
                currentGymBalance: (doc.data().totalGymDeposited || 0) - (doc.data().totalGymPaid || 0)
            }));

            const filteredGymMembersBalances = gymMembers.map(fm => {
                const existing = balancesData.find(b => b.id === fm.id);
                return existing || { id: fm.id, name: fm.name, totalGymDeposited: 0, totalGymPaid: 0, currentGymBalance: 0 };
            });
            setGymMembersBalances(filteredGymMembersBalances);

        }, (error) => {
            console.error("Error fetching GYM members balances:", error);
            setMessage("Error fetching GYM balances. Please try again.");
        });

        return () => unsubscribe();
    }, [db, appId]);

    const handleAddGymContribution = async () => {
        setMessage('');
        if (!db) {
            setMessage('Firebase not initialized.');
            return;
        }

        const amount = parseFloat(gymContributionAmount);
        if (isNaN(amount) || amount <= 0) {
            setMessage('Please enter a valid positive GYM contribution amount.');
            return;
        }

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/members`, selectedGymMemberId);
            const memberSnap = await getDoc(memberDocRef);

            let currentGymDeposited = 0;
            if (memberSnap.exists()) {
                currentGymDeposited = memberSnap.data().totalGymDeposited || 0;
            } else {
                await setDoc(memberDocRef, {
                    id: selectedGymMemberId,
                    name: flatMembers.find(m => m.id === selectedGymMemberId)?.name || selectedGymMemberId,
                    totalDeposited: 0,
                    totalPaid: 0,
                    totalGymDeposited: 0,
                    totalGymPaid: 0,
                });
            }
            await updateDoc(memberDocRef, { totalGymDeposited: currentGymDeposited + amount });

            await addDoc(collection(db, `artifacts/${appId}/public/data/contributions`), {
                memberId: selectedGymMemberId,
                amount: amount,
                date: new Date(),
                description: `GYM contribution by ${flatMembers.find(m => m.id === selectedGymMemberId)?.name || selectedGymMemberId}`,
                tags: ['GYM', 'contribution']
            });

            setMessage(`GYM contribution of ${formatCurrency(amount)} added for ${flatMembers.find(m => m.id === selectedGymMemberId)?.name || selectedGymMemberId}.`);
            setGymContributionAmount('');
        } catch (error) {
            console.error("Error adding GYM contribution:", error);
            setMessage(`Error adding GYM contribution: ${error.message}`);
        }
    };

    const openGymEditModal = (memberId, field, currentValue) => {
        setGymEditMemberId(memberId);
        setGymEditField(field);
        setGymEditValue(currentValue.toFixed(2));
        setShowGymEditModal(true);
    };

    const handleGymEditSubmit = async () => {
        setMessage('');
        if (!db || !gymEditMemberId || !gymEditField) return;

        const newValue = parseFloat(gymEditValue);
        if (isNaN(newValue) || newValue < 0) {
            setMessage('Please enter a valid non-negative amount.');
            return;
        }

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/members`, gymEditMemberId);
            await updateDoc(memberDocRef, { [gymEditField]: newValue });
            setMessage(`${gymEditField === 'totalGymDeposited' ? 'GYM Deposit' : 'GYM Paid'} updated successfully for ${flatMembers.find(m => m.id === gymEditMemberId)?.name || gymEditMemberId}.`);
            setShowGymEditModal(false);
            setGymEditValue('');
            setGymEditMemberId('');
            setGymEditField('');
        } catch (error) {
            console.error("Error updating GYM balance field:", error);
            setMessage(`Error updating ${gymEditField}: ${error.message}`);
        }
    };

    const viewGymContributionHistory = async (memberId) => {
        if (!db) return;
        setSelectedGymMemberForHistory(flatMembers.find(m => m.id === memberId));
        try {
            const q = query(collection(db, `artifacts/${appId}/public/data/contributions`), where("memberId", "==", memberId), where("tags", "array-contains", "GYM"));
            const querySnapshot = await getDocs(q);
            const history = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate()
            }));
            history.sort((a, b) => b.date.getTime() - a.date.getTime());
            setGymMemberContributionsHistory(history);
            setShowGymContributionHistoryModal(true);
        } catch (error) {
            console.error("Error fetching GYM contribution history:", error);
            setMessage(`Error fetching GYM history: ${error.message}`);
        }
    };

    const totalGymExpenses = gymExpenses.reduce((sum, exp) => sum + exp.cost, 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl mx-auto my-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">GYM Dashboard</h2>
            {message && (
                <div className={`p-3 rounded-lg text-center font-medium mb-4 animate-bounce-in ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            {/* Add GYM Expense Button */}
            <div className="mb-8 text-center">
                <button
                    onClick={navigateToAddGymExpense}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold text-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                >
                    Add New GYM Expense
                </button>
            </div>

            {/* GYM Top-Up Section */}
            <div className="mb-8 p-5 border border-purple-300 rounded-lg bg-purple-50 shadow-md transform transition-all duration-300 hover:shadow-xl">
                <h3 className="text-xl font-semibold text-purple-700 mb-4">Add GYM Contribution (Karthik & Shiva Only)</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="selectGymMember" className="block text-sm font-medium text-gray-700 mb-1">
                            Select Member
                        </label>
                        <select
                            id="selectGymMember"
                            value={selectedGymMemberId}
                            onChange={(e) => setSelectedGymMemberId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-600 focus:border-purple-600 bg-white transition duration-200 shadow-sm hover:border-purple-400"
                        >
                            {gymMembers.map(member => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="gymContributionAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Amount (₹)
                        </label>
                        <input
                            type="number"
                            id="gymContributionAmount"
                            value={gymContributionAmount}
                            onChange={(e) => setGymContributionAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-600 focus:border-purple-600 transition duration-200 shadow-sm hover:border-purple-400"
                            placeholder="e.g., 500"
                            step="0.01"
                            required
                        />
                    </div>
                    <button
                        onClick={handleAddGymContribution}
                        className="w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                    >
                        Add GYM Contribution
                    </button>
                </div>
            </div>

            {/* Individual GYM Balances Table */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Individual GYM Balances</h3>
                {gymMembersBalances.length === 0 ? (
                    <p className="text-center text-gray-500">No GYM balance data available.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Member</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Deposited (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Paid (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Current Balance (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {gymMembersBalances.map((member) => (
                                    <tr key={member.id} className="hover:bg-purple-50 transition-colors duration-200">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{member.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalGymDeposited || 0)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalGymPaid || 0)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                            <span className={member.currentGymBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatCurrency(member.currentGymBalance)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => openGymEditModal(member.id, 'totalGymDeposited', member.totalGymDeposited)}
                                                className="text-emerald-600 hover:text-emerald-800 hover:scale-110 mr-3 transition-all duration-200"
                                            >
                                                Edit Deposit
                                            </button>
                                            <button
                                                onClick={() => openGymEditModal(member.id, 'totalGymPaid', member.totalGymPaid)}
                                                className="text-teal-600 hover:text-teal-800 hover:scale-110 transition-all duration-200"
                                            >
                                                Edit Paid
                                            </button>
                                            <button
                                                onClick={() => viewGymContributionHistory(member.id)}
                                                className="text-purple-600 hover:text-purple-800 hover:scale-110 ml-3 transition-all duration-200"
                                            >
                                                History
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Recent GYM-related Transactions */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Recent GYM Transactions</h3>
                {gymExpenses.length === 0 ? (
                    <p className="text-center text-gray-500">No recent GYM transactions.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Item Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cost (INR)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Buyer</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Shared With</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {gymExpenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-purple-50 transition-colors duration-200">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(expense.date)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{expense.itemName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(expense.cost)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                            {flatMembers.find(m => m.id === expense.buyerId)?.name || expense.buyerId}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {expense.sharedWith.map(id => flatMembers.find(m => m.id === id)?.name || id).join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* GYM Edit Modal */}
            {showGymEditModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full transform transition-all duration-300 scale-100 animate-zoom-in">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Edit {gymEditField === 'totalGymDeposited' ? 'GYM Deposited' : 'GYM Paid'} for {flatMembers.find(m => m.id === gymEditMemberId)?.name || gymEditMemberId}
                        </h3>
                        <input
                            type="number"
                            value={gymEditValue}
                            onChange={(e) => setGymEditValue(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-600 focus:border-purple-600 mb-4 transition duration-200 shadow-sm hover:border-purple-400"
                            step="0.01"
                            required
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowGymEditModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGymEditSubmit}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GYM Contribution History Modal */}
            {showGymContributionHistoryModal && selectedGymMemberForHistory && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full transform transition-all duration-300 scale-100 animate-zoom-in">
                        <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                            GYM Contribution History for {selectedGymMemberForHistory.name}
                        </h3>
                        {gymMemberContributionsHistory.length === 0 ? (
                            <p className="text-center text-gray-500">No GYM contribution history found for this member.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm max-h-80">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount (₹)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {gymMemberContributionsHistory.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-purple-50 transition-colors duration-200">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(entry.date)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(entry.amount)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">{entry.description || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {(entry.tags && entry.tags.length > 0) ? entry.tags.join(', ') : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setShowGymContributionHistoryModal(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ReportDisplay Component (Displays report directly in UI)
function ReportDisplay({ expenses, contributions, membersBalances, startDate, endDate }) {
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.cost, 0);
    const totalContributions = contributions.reduce((sum, cont) => sum + cont.amount, 0);

    // Calculate Monthly Expense Breakdown
    const monthlyExpenses = expenses.reduce((acc, expense) => {
        const monthYear = new Date(expense.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!acc[monthYear]) {
            acc[monthYear] = { total: 0, spenders: {}, sharedWithCounts: {} };
        }
        acc[monthYear].total += expense.cost;
        acc[monthYear].spenders[expense.buyerId] = (acc[monthYear].spenders[expense.buyerId] || 0) + expense.cost;
        expense.sharedWith.forEach(memberId => {
            acc[monthYear].sharedWithCounts[memberId] = (acc[monthYear].sharedWithCounts[memberId] || 0) + 1;
        });
        return acc;
    }, {});

    const monthlyBreakdown = Object.keys(monthlyExpenses).map(monthYear => {
        const monthData = monthlyExpenses[monthYear];
        const topSpenderId = Object.keys(monthData.spenders).reduce((a, b) => monthData.spenders[a] > monthData.spenders[b] ? a : b, null);
        const mostSharedWithId = Object.keys(monthData.sharedWithCounts).reduce((a, b) => monthData.sharedWithCounts[a] > monthData.sharedWithCounts[b] ? a : b, null);

        return {
            month: monthYear,
            total: monthData.total,
            topSpender: flatMembers.find(m => m.id === topSpenderId)?.name || topSpenderId,
            mostSharedWith: flatMembers.find(m => m.id === mostSharedWithId)?.name || mostSharedWithId,
        };
    }).sort((a, b) => new Date(b.month) - new Date(a.month));


    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mx-auto my-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Flat Expense Report</h2>
            <p className="text-center text-gray-600 mb-6">
                Generated On: {formatDate(new Date())} <br />
                {startDate || endDate ? `Date Range: ${startDate ? formatDate(startDate) : 'Start'} to ${endDate ? formatDate(endDate) : 'End'}` : '(All Time)'}
            </p>

            {/* 1. Monthly Expense Breakdown */}
            <div className="mb-8 p-4 border border-teal-300 rounded-lg bg-teal-50 shadow-md transform transition-all duration-300 hover:shadow-xl">
                <h3 className="text-xl font-semibold text-teal-700 mb-3">1. Monthly Expense Breakdown</h3>
                {monthlyBreakdown.length === 0 ? (
                    <p className="text-center text-gray-500">No monthly expense data available.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Month</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Expenses (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Top Spender</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Most Shared With</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {monthlyBreakdown.map((monthData) => (
                                    <tr key={monthData.month} className="hover:bg-emerald-50 transition-colors duration-200">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{monthData.month}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(monthData.total)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{monthData.topSpender || 'N/A'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{monthData.mostSharedWith || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 2. User-wise Contribution Summary */}
            <div className="mb-8 p-4 border border-teal-300 rounded-lg bg-teal-50 shadow-md transform transition-all duration-300 hover:shadow-xl">
                <h3 className="text-xl font-semibold text-teal-700 mb-3">2. User-wise Contribution Summary</h3>
                {membersBalances.length === 0 ? (
                    <p className="text-center text-gray-500">No user summary data available.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Deposited (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Paid (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Current Balance (₹)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {membersBalances.map((member) => (
                                    <tr key={member.id} className="hover:bg-emerald-50 transition-colors duration-200">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{member.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalDeposited)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(member.totalPaid)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                            <span className={member.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatCurrency(member.currentBalance)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 3. Contribution History per Person */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">3. Contribution History per Person</h3>
                {flatMembers.map(member => {
                    const memberContributions = contributions.filter(c => c.memberId === member.id);
                    const totalMemberContributions = memberContributions.reduce((sum, c) => sum + c.amount, 0);
                    return (
                        <div key={member.id} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm animate-fade-in-up">
                            <h4 className="text-lg font-bold text-gray-800 mb-2">🧍‍♂️ {member.name}</h4>
                            {memberContributions.length === 0 ? (
                                <p className="text-center text-gray-500 text-sm">No contributions for this member.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-100">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount (₹)</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Description</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tags</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {memberContributions.map(entry => (
                                                <tr key={entry.id} className="hover:bg-emerald-50 transition-colors duration-200">
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{formatDate(entry.date)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{formatCurrency(entry.amount)}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{entry.description || 'N/A'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">
                                                        {(entry.tags && entry.tags.length > 0) ? entry.tags.join(', ') : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="text-right text-md font-bold text-gray-800 mt-2">Total: {formatCurrency(totalMemberContributions)}</p>
                        </div>
                    );
                })}
            </div>

            {/* 4. Detailed Expense Log */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">4. Detailed Expense Log</h3>
                {expenses.length === 0 ? (
                    <p className="text-center text-gray-500">No detailed expense log available for this period.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Item</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cost (₹)</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Buyer</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Shared With</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-emerald-50 transition-colors duration-200">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(expense.date)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{expense.itemName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatCurrency(expense.cost)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{expense.category}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                            {flatMembers.find(m => m.id === expense.buyerId)?.name || expense.buyerId}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {expense.sharedWith.map(id => flatMembers.find(m => m.id === id)?.name || id).join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}


// Generate Report Dashboard Component (Modified to display report directly)
function GenerateReportDashboard() {
    const { db, appId } = useContext(FirebaseContext);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState(null);

    const handleGenerateReport = async () => {
        setMessage('');
        setIsLoading(true);
        setReportData(null);
        if (!db) {
            setMessage('Firebase not initialized.');
            setIsLoading(false);
            return;
        }

        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end && start > end) {
            setMessage('Start date cannot be after end date.');
            setIsLoading(false);
            return;
        }

        try {
            let expensesQuery = collection(db, `artifacts/${appId}/public/data/expenses`);
            if (start) {
                expensesQuery = query(expensesQuery, where('date', '>=', start));
            }
            if (end) {
                const nextDay = new Date(end);
                nextDay.setDate(nextDay.getDate() + 1);
                expensesQuery = query(expensesQuery, where('date', '<', nextDay));
            }
            const expensesSnapshot = await getDocs(expensesQuery);
            const expenses = expensesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            }));
            expenses.sort((a, b) => b.date.getTime() - a.date.getTime());

            let contributionsQuery = collection(db, `artifacts/${appId}/public/data/contributions`);
            if (start) {
                contributionsQuery = query(contributionsQuery, where('date', '>=', start));
            }
            if (end) {
                const nextDay = new Date(end);
                nextDay.setDate(nextDay.getDate() + 1);
                contributionsQuery = query(contributionsQuery, where('date', '<', nextDay));
            }
            const contributionsSnapshot = await getDocs(contributionsQuery);
            const contributions = contributionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate(),
            }));
            contributions.sort((a, b) => a.date.getTime() - b.date.getTime());

            const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/members`);
            const membersSnapshot = await getDocs(membersCollectionRef);
            const membersBalances = membersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                currentBalance: (doc.data().totalDeposited || 0) - (doc.data().totalPaid || 0)
            }));
            const fullMembersBalances = flatMembers.map(fm => {
                const existing = membersBalances.find(b => b.id === fm.id);
                return existing || { id: fm.id, name: fm.name, totalDeposited: 0, totalPaid: 0, currentBalance: 0 };
            });

            setReportData({ expenses, contributions, membersBalances: fullMembersBalances, startDate: start, endDate: end });
            setMessage('Report generated successfully!');
        } catch (error) {
            console.error("Error generating report:", error);
            setMessage(`Error generating report: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl mx-auto my-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Generate Report</h2>
            <div className="space-y-5">
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date (dd-mm-yyyy)
                    </label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                    />
                </div>
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                        End Date (dd-mm-yyyy)
                    </label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-600 focus:border-emerald-600 transition duration-200 shadow-sm hover:border-emerald-400"
                    />
                </div>
                {message && (
                    <div className={`p-3 rounded-lg text-center font-medium ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} animate-bounce-in`}>
                        {message}
                    </div>
                )}
                <button
                    onClick={handleGenerateReport}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-700 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:from-teal-700 hover:to-emerald-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition duration-300 transform hover:scale-105 active:scale-95"
                    disabled={isLoading}
                >
                    {isLoading ? 'Generating Report...' : 'Generate Report'}
                </button>

                {reportData && (
                    <div className="mt-8">
                        <ReportDisplay
                            expenses={reportData.expenses}
                            contributions={reportData.contributions}
                            membersBalances={reportData.membersBalances}
                            startDate={reportData.startDate}
                            endDate={reportData.endDate}
                        />
                        <button
                            onClick={() => setReportData(null)}
                            className="w-full mt-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white py-2 rounded-lg font-semibold shadow-md hover:from-gray-500 hover:to-gray-600 transition duration-300 transform hover:scale-105 active:scale-95"
                        >
                            Clear Report
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
