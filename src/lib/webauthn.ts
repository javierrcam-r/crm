// WebAuthn utilities para autenticación biométrica (Face ID, Touch ID, huella)

// Verificar si WebAuthn está soportado
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && 
         window.PublicKeyCredential !== undefined &&
         typeof window.PublicKeyCredential === 'function';
}

// Verificar si el dispositivo tiene autenticador de plataforma (Face ID, Touch ID, etc.)
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Generar un challenge aleatorio
function generateChallenge(): Uint8Array {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

// Convertir ArrayBuffer a Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convertir Base64 a ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Registrar nueva credencial biométrica
export async function registerBiometric(
  userId: string,
  username: string,
  displayName: string
): Promise<{
  credentialId: string;
  publicKey: string;
} | null> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn no está soportado en este navegador');
  }

  const challenge = generateChallenge();

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'CRM Disfero',
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(userId),
      name: username,
      displayName: displayName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Solo autenticadores de plataforma (Face ID, Touch ID)
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('No se pudo crear la credencial');
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      publicKey: arrayBufferToBase64(response.getPublicKey() || response.attestationObject),
    };
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Autenticación cancelada por el usuario');
    }
    throw error;
  }
}

// Autenticar con biometría
export async function authenticateWithBiometric(
  credentialIds: string[]
): Promise<{
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
} | null> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn no está soportado en este navegador');
  }

  if (credentialIds.length === 0) {
    throw new Error('No hay credenciales biométricas registradas');
  }

  const challenge = generateChallenge();

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    allowCredentials: credentialIds.map(id => ({
      id: base64ToArrayBuffer(id),
      type: 'public-key' as const,
      transports: ['internal'] as AuthenticatorTransport[],
    })),
    userVerification: 'required',
    timeout: 60000,
  };

  try {
    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('No se pudo obtener la credencial');
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      signature: arrayBufferToBase64(response.signature),
      authenticatorData: arrayBufferToBase64(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
    };
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Autenticación cancelada por el usuario');
    }
    throw error;
  }
}

// Obtener nombre del tipo de biometría disponible
export async function getBiometricType(): Promise<string> {
  const available = await isPlatformAuthenticatorAvailable();
  if (!available) return 'No disponible';

  // Detectar tipo de dispositivo
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad/.test(ua)) {
    return 'Face ID / Touch ID';
  } else if (/android/.test(ua)) {
    return 'Huella digital / Face Unlock';
  } else if (/mac/.test(ua)) {
    return 'Touch ID';
  } else if (/windows/.test(ua)) {
    return 'Windows Hello';
  }
  
  return 'Biometría';
}
