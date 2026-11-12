// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightBlog from 'starlight-blog';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    site: 'https://sam.lair.knowledge-forge.ai',
    integrations: [starlight({
        title: 'Sam Lair',
        disable404Route: true,
        components: { Footer: './src/components/LegacyFooter.astro' },
        social: [
            { icon: 'server', label: 'Knowledge Forge AI', href: 'https://www.knowledge-forge.ai'},
            { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/samuel-lair' },
            { icon: 'github', label: 'GitHub', href: 'https://github.com/lair001' }
        ],
        customCss: ['./src/styles/legacy.css'],
        sidebar: [{ label: 'Personal journal', link: '/journal/' }],
        plugins: [
            starlightBlog(),
        ],
    }), react()],
});
