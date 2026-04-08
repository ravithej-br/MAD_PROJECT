// src/store/useAuthStore.js
import { create } from 'zustand';

const useAuthStore = create((set) => ({
    user: null,
    role: null, // 'poster' | 'runner'
    isLoading: true,

    setUser: (user) => set({ user }),
    setRole: (role) => set({ role }),
    setLoading: (isLoading) => set({ isLoading }),
    logout: () => set({ user: null, role: null }),
}));

export default useAuthStore;
