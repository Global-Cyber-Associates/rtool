import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

let toastCount = 0;
const observers = new Set();

export const toast = {
    success: (message) => notify(message, 'success'),
    error: (message) => notify(message, 'error'),
    info: (message) => notify(message, 'info'),
};

function notify(message, type) {
    const id = ++toastCount;
    const duration = 5000;
    const newToast = { id, message, type, duration };
    observers.forEach((cb) => cb(newToast));
}

export const Toaster = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        setToasts((prev) => [...prev, toast]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useEffect(() => {
        observers.add(addToast);
        return () => observers.delete(addToast);
    }, [addToast]);

    return (
        <div className="toast-container">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onRemove={removeToast} />
                ))}
            </AnimatePresence>
        </div>
    );
};

const ToastItem = forwardRef(({ toast, onRemove }, ref) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, toast.duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8, transition: { duration: 0.2 } }}
            className={`toast-item ${toast.type}`}
        >
            <div className="toast-content">
                <div className="toast-icon-wrapper">
                    {toast.type === 'success' && <CheckCircle size={18} />}
                    {toast.type === 'error' && <AlertCircle size={18} />}
                    {toast.type === 'info' && <Info size={18} />}
                </div>
                <div className="toast-message-body">
                    <span className="toast-title">
                        {toast.type === 'success' && 'Operation Successful'}
                        {toast.type === 'error' && 'System Error'}
                        {toast.type === 'info' && 'Notification'}
                    </span>
                    <p className="toast-text">{toast.message}</p>
                </div>
                <button className="toast-close-btn" onClick={() => onRemove(toast.id)}>
                    <X size={14} />
                </button>
            </div>
            <motion.div
                className="toast-progress-bar"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: toast.duration / 1000, ease: 'linear' }}
            />
        </motion.div>
    );
});
