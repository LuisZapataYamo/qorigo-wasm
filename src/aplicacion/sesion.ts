import type { DatosQoriGo } from './puertos/persistencia';
import type { Rol, Usuario } from '../dominio/modelo';
import { auditar, guardarConfiguracion } from './auditoria';
import {
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { nuevoId } from '../dominio/ids';

const ITERACIONES = 100_000;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos.';

function aBase64(datos: Uint8Array): string {
  let binario = '';
  for (const byte of datos) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

async function derivar(
  password: string,
  sal: Uint8Array,
  iteraciones: number,
): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sal as BufferSource, iterations: iteraciones, hash: 'SHA-256' },
    clave,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, sal, ITERACIONES);
  return `pbkdf2$${ITERACIONES}$${aBase64(sal)}$${aBase64(hash)}`;
}

export async function verificarPassword(
  password: string,
  almacenado: string,
): Promise<boolean> {
  const [algoritmo, iteraciones, sal, hash] = almacenado.split('$');
  if (algoritmo !== 'pbkdf2' || !iteraciones || !sal || !hash) return false;
  const esperado = deBase64(hash);
  const calculado = await derivar(
    password,
    deBase64(sal),
    Number(iteraciones),
  );
  if (esperado.length !== calculado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferencia |= esperado[i] ^ calculado[i];
  }
  return diferencia === 0;
}

function validarEmail(email: string): string {
  const limpio = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    throw new ErrorValidacion('El correo no es válido.', 'email');
  }
  return limpio;
}

function validarPassword(password: string): void {
  if (password.length < 8) {
    throw new ErrorValidacion(
      'La contraseña debe tener al menos 8 caracteres.',
      'password',
    );
  }
}

async function emailDisponible(
  db: DatosQoriGo,
  email: string,
  exceptoId?: string,
): Promise<void> {
  const existente = await db.usuarios.where('email').equals(email).first();
  if (existente && existente.id !== exceptoId) {
    throw new ErrorReglaNegocio('Ese correo ya tiene un acceso local.');
  }
}

async function leerSesion(
  db: DatosQoriGo,
  clave: string,
): Promise<string | undefined> {
  return (await db.sesion.get(clave))?.valor;
}

async function guardarSesion(
  db: DatosQoriGo,
  clave: string,
  valor: string,
): Promise<void> {
  await db.sesion.put({ clave, valor });
}

async function borrarSesion(db: DatosQoriGo, clave: string): Promise<void> {
  await db.sesion.delete(clave);
}

export interface DatosAcceso {
  personaId: string;
  email: string;
  password: string;
}

/**
 * CU-23 adaptado a una PWA local: crea el acceso del administrador de este
 * dispositivo. No hay autenticación remota; el bloqueo es una barrera de uso,
 * no una frontera de seguridad frente a quien controla el dispositivo.
 */
export async function configurarAcceso(
  db: DatosQoriGo,
  datos: DatosAcceso,
): Promise<Usuario> {
  const persona = await db.personas.get(datos.personaId);
  if (!persona) throw new ErrorNoEncontrado('La persona no existe.');
  const email = validarEmail(datos.email);
  validarPassword(datos.password);
  await emailDisponible(db, email);

  const admin = await db.usuarios
    .filter((u) => u.rol === 'ADMIN' && u.activo)
    .first();
  if (admin) {
    throw new ErrorReglaNegocio('Ya existe un acceso de administrador.');
  }

  const usuario: Usuario = {
    id: nuevoId(),
    personaId: datos.personaId,
    email,
    passwordHash: await hashPassword(datos.password),
    rol: 'ADMIN',
    activo: true,
    creadoEn: new Date().toISOString(),
  };

  await db.transaction(
    'rw',
    [db.usuarios, db.sesion, db.configuracion, db.auditoria],
    async () => {
      await db.usuarios.add(usuario);
      await guardarSesion(db, 'usuario_actual', usuario.id);
      await guardarConfiguracion(db, 'acceso_configurado', 'SI');
      await auditar(db, {
        entidad: 'USUARIO',
        entidadId: usuario.id,
        accion: 'CREAR',
        despues: { email, rol: usuario.rol, personaId: usuario.personaId },
      });
    },
  );

  return usuario;
}

export async function crearAccesoPersona(
  db: DatosQoriGo,
  datos: DatosAcceso & { rol?: Rol },
): Promise<Usuario> {
  const persona = await db.personas.get(datos.personaId);
  if (!persona) throw new ErrorNoEncontrado('La persona no existe.');
  const email = validarEmail(datos.email);
  validarPassword(datos.password);
  await emailDisponible(db, email);

  const usuario: Usuario = {
    id: nuevoId(),
    personaId: datos.personaId,
    email,
    passwordHash: await hashPassword(datos.password),
    rol: datos.rol ?? 'MEMBER',
    activo: true,
    creadoEn: new Date().toISOString(),
  };

  await db.transaction(
    'rw',
    [db.usuarios, db.auditoria],
    async () => {
      await db.usuarios.add(usuario);
      await auditar(db, {
        entidad: 'USUARIO',
        entidadId: usuario.id,
        accion: 'CREAR',
        despues: { email, rol: usuario.rol, personaId: usuario.personaId },
      });
    },
  );

  return usuario;
}

export async function iniciarSesion(
  db: DatosQoriGo,
  email: string,
  password: string,
  ahora: Date = new Date(),
): Promise<Usuario> {
  const bloqueo = await leerSesion(db, 'bloqueo_hasta');
  if (bloqueo && Date.parse(bloqueo) > ahora.getTime()) {
    throw new ErrorReglaNegocio(
      'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.',
    );
  }

  const usuario = await db.usuarios
    .where('email')
    .equals(email.trim().toLowerCase())
    .first();
  if (!usuario || !usuario.activo) {
    throw new ErrorValidacion(ERROR_CREDENCIALES);
  }

  const valida = await verificarPassword(password, usuario.passwordHash);
  if (!valida) {
    const intentos =
      Number((await leerSesion(db, 'intentos_fallidos')) ?? '0') + 1;
    await guardarSesion(db, 'intentos_fallidos', String(intentos));
    if (intentos >= MAX_INTENTOS) {
      await guardarSesion(
        db,
        'bloqueo_hasta',
        new Date(ahora.getTime() + BLOQUEO_MS).toISOString(),
      );
      await borrarSesion(db, 'intentos_fallidos');
    }
    throw new ErrorValidacion(ERROR_CREDENCIALES);
  }

  await db.transaction('rw', [db.sesion, db.auditoria], async () => {
    await borrarSesion(db, 'intentos_fallidos');
    await borrarSesion(db, 'bloqueo_hasta');
    await guardarSesion(db, 'usuario_actual', usuario.id);
    await auditar(db, {
      entidad: 'USUARIO',
      entidadId: usuario.id,
      accion: 'INICIAR_SESION',
    });
  });

  return usuario;
}

export async function sesionActual(
  db: DatosQoriGo,
): Promise<Usuario | null> {
  const id = await leerSesion(db, 'usuario_actual');
  if (!id) return null;
  const usuario = await db.usuarios.get(id);
  if (!usuario || !usuario.activo) return null;
  return usuario;
}

export async function cerrarSesion(db: DatosQoriGo): Promise<void> {
  await borrarSesion(db, 'usuario_actual');
}

export async function listarUsuarios(db: DatosQoriGo): Promise<Usuario[]> {
  return db.usuarios.toArray();
}

export async function cambiarPassword(
  db: DatosQoriGo,
  usuarioId: string,
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  const usuario = await db.usuarios.get(usuarioId);
  if (!usuario) throw new ErrorNoEncontrado('El usuario no existe.');
  if (!(await verificarPassword(passwordActual, usuario.passwordHash))) {
    throw new ErrorValidacion(ERROR_CREDENCIALES);
  }
  validarPassword(passwordNueva);
  const actualizado: Usuario = {
    ...usuario,
    passwordHash: await hashPassword(passwordNueva),
  };
  await db.transaction('rw', [db.usuarios, db.auditoria], async () => {
    await db.usuarios.put(actualizado);
    await auditar(db, {
      entidad: 'USUARIO',
      entidadId: usuarioId,
      accion: 'CAMBIAR_PASSWORD',
    });
  });
}

/**
 * Sin servidor no existe recuperación remota. Se informa con claridad para no
 * prometer un enlace que la aplicación no puede enviar.
 */
export async function recuperarAcceso(): Promise<never> {
  throw new ErrorReglaNegocio(
    'Esta aplicación no envía correos ni enlaces de recuperación porque funciona sin servidor. Restaura un respaldo o configura el acceso de nuevo en este dispositivo.',
  );
}
