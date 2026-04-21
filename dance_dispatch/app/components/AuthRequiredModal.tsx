'use client';

import React from 'react';

interface AuthRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
    message?: string;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
    isOpen,
    onClose,
    message = 'Please log in or sign up to continue.',
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center rounded-lg bg-bg p-6 shadow-lg dark:bg-surface">
                <p className="mb-4 text-center text-text">{message}</p>
                <button
                    onClick={() => {
                        window.location.href = '/auth/login';
                    }}
                    className="btn-highlighted mb-2 rounded bg-red-500 px-4 py-2 text-text hover:bg-red-600"
                >
                    Go to Login
                </button>
                <button
                    onClick={() => {
                        window.location.href = '/auth/signup';
                    }}
                    className="btn-highlighted mb-2 rounded bg-red-500 px-4 py-2 text-text hover:bg-red-600"
                >
                    Go to Sign Up
                </button>
                <button
                    onClick={onClose}
                    className="text-muted hover:underline"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};
