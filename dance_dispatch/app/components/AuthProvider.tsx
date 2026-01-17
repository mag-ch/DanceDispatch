// // app/providers/AuthProvider.tsx
// 'use client';
// import { createClient } from '@/lib/supabase/server';
// import { useRouter, usePathname } from 'next/navigation';
// import { useEffect, useState } from 'react';

// export function AuthProvider({ children }: { children: React.ReactNode }) {
//     const supabase = createClient();
//     const router = useRouter();
//     const pathname = usePathname();
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         const checkSession = async () => {
//             const { data } = await supabase.auth.getSession();
            
//             // If user is logged in and on auth pages, redirect home
//             if (data.session && pathname?.startsWith('/auth/')) {
//                 router.push('/');
//             }
//             // If user is NOT logged in and on protected pages, redirect to login
//             else if (!data.session && pathname !== '/auth/login' && pathname !== '/auth/signup') {
//                 // Optionally redirect - depends on your app
//             }
            
//             setLoading(false);
//         };

//         checkSession();

//         // Listen for auth changes
//         const { data } = supabase.auth.onAuthStateChange((event, session) => {
//             if (event === 'SIGNED_IN') {
//                 router.push('/');
//             } else if (event === 'SIGNED_OUT') {
//                 router.push('/auth/login');
//             }
//         });

//         return () => {
//             data?.subscription.unsubscribe();
//         };
//     }, [supabase, router, pathname]);

//     if (loading) return null;

//     return children;
// }