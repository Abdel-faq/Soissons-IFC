import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
    // Charge les variables d'env (y compris celles sans préfixe VITE_ sur Vercel)
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        define: {
            // Permet au frontend d'accéder aux variables même sans le préfixe VITE_
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
            'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || env.SUPABASE_KEY),
        },
        server: {
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:3000',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
})
