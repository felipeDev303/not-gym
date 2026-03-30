/// <reference types="astro/client" />

// CORRECCIÓN: Se cambió la referencia de `path` a `types` para seguir la convención moderna de Astro.
// La línea anterior /// <reference path="../.astro/types.d.ts" /> también funciona, pero esta es la recomendada.

declare global {
  // Esta parte se mantiene para la función global de MailerLite en el objeto `window`
  interface Window {
    ml: (action: string, accountId: string, data?: any) => void;
  }
}

// Este archivo contiene los valores reales de tus claves.
// NUNCA lo subas a GitHub.

// Clave de API de Google Maps
PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyDggPwB2rA8hBBzsAXZvQHi8_mmZ0aowl8";

// Configuración de tu App Web de Firebase
//PUBLIC_FIREBASE_API_KEY=""
PUBLIC_FIREBASE_AUTH_DOMAIN = "app-not-gym.firebaseapp.com";
PUBLIC_FIREBASE_PROJECT_ID = "app-not-gym";
PUBLIC_FIREBASE_STORAGE_BUCKET = "app-not-gym.appspot.com";
//PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
//PUBLIC_FIREBASE_APP_ID=""

// CORRECCIÓN: Aquí añadimos la definición de tipos para nuestras variables de entorno.
interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_MAPS_API_KEY: string;
  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;
  // Añade aquí cualquier otra variable de entorno que vayas a utilizar
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// La línea `export {};` no es estrictamente necesaria si tienes otras declaraciones,
// pero es una buena práctica para asegurar que el archivo sea tratado como un módulo.
// Lo mantenemos por si acaso.
export {};
