import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

const Noir = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{teal.50}',
            100: '{teal.100}',
            200: '{teal.200}',
            300: '{teal.300}',
            400: '{teal.400}',
            500: '{teal.500}',
            600: '{teal.600}',
            700: '{teal.700}',
            800: '{teal.800}',
            900: '{teal.900}',
            950: '{teal.950}'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '{teal.500}',
                    contrastColor: '#ffffff',
                    hoverColor: '{teal.600}',
                    activeColor: '{teal.700}'
                },
                highlight: {
                    background: '{teal.50}',
                    focusBackground: '{teal.100}',
                    color: '{teal.700}',
                    focusColor: '{teal.800}'
                }
            },
            dark: {
                primary: {
                    color: '{teal.400}',
                    contrastColor: '{surface.900}',
                    hoverColor: '{teal.300}',
                    activeColor: '{teal.200}'
                },
                highlight: {
                    background: 'color-mix(in srgb, {teal.400}, transparent 84%)',
                    focusBackground: 'color-mix(in srgb, {teal.400}, transparent 76%)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)'
                }
            }
        }
    }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),

    // ✅ HTTP Client con interceptor de autenticación
    provideHttpClient(withInterceptors([authInterceptor])),

    // ✅ NECESARIO para PrimeNG (Dialog/Panel/Animaciones)
    provideAnimationsAsync(),

    // ✅ PrimeNG + Theme (Teal + sin dark mode forzado)
    providePrimeNG({
      theme: {
        preset: Noir,
        options: { darkModeSelector: 'none' }
      }
    })
  ]
};