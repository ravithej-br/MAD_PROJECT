// src/store/useTaskStore.js
import { create } from 'zustand';

const useTaskStore = create((set) => ({
    tasks: [],
    myTasks: [],
    activeTask: null,

    setTasks: (tasks) => set({ tasks }),
    setMyTasks: (myTasks) => set({ myTasks }),
    setActiveTask: (task) => set({ activeTask: task }),
    addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
    updateTask: (taskId, updates) =>
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
            ),
            myTasks: state.myTasks.map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
            ),
        })),
}));

export default useTaskStore;
