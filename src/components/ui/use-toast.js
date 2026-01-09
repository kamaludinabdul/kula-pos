import { useState, useEffect } from 'react';

const listeners = new Set();
let toasts = [];

export const toast = ({ title, description, variant = 'default', duration = 3000 }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, title, description, variant, duration };
    toasts = [...toasts, newToast];
    listeners.forEach(listener => listener(toasts));

    if (duration > 0) {
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            listeners.forEach(listener => listener(toasts));
        }, duration);
    }
};

export const useToast = () => {
    const [state, setState] = useState(toasts);

    useEffect(() => {
        listeners.add(setState);
        return () => {
            listeners.delete(setState);
        };
    }, []);

    return { toast, toasts: state };
};
