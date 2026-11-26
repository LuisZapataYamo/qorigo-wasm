import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import { cobranza, cobranzaACsv } from '../aplicacion/reportes';
import { crearPrestamo } from '../aplicacion/prestamos';
import { registrarPersona } from '../aplicacion/personas';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { agregarMiembro } from '../aplicacion/miembros';
import { nuevoId } from '../dominio/ids';
import { fijarHoy } from '../dominio/fechas';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona(nombres: string, apellidos: string) {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function prestamo(
  personaId: string,
  capital: string,
  plazo: number,
  primerPago: string,
  estricto: boolean,
) {
  return crearPrestamo(db, {
    personaId,
    moneda: 'PEN',
    capital,
    tasaMensual: 0,
    plazoMeses: plazo,
    fechaPrestamo: '2026-08-01',
    fechaPrimerPago: primerPago,
    estrictoCumplimiento: estricto,
  });
}

describe('CU-21 Informe de cobranza y cartera vencida', () => {
  it('PA-CU21-01 el préstamo estricto acumula arrastre y cuota del mes', async () => {
    fijarHoy('2026-11-24');
    const persona1 = await persona('Ana', 'Alvarez');
    await prestamo(persona1.id, '900.00', 3, '2026-10-01', true);

    const informe = await cobranza(db, '2026-11-01', 'PEN');

    expect(informe.prestamos).toHaveLength(1);
    expect(informe.prestamos[0]?.saldoAnteriorCentimos).toBe(30000);
    expect(informe.prestamos[0]?.cuotaMesCentimos).toBe(30000);
    expect(informe.prestamos[0]?.exigibleCentimos).toBe(60000);
    expect(informe.exigiblePrestamosCentimos).toBe(60000);
  });

  it('PA-CU21-02 el flexible no acumula lo atrasado al exigible', async () => {
    fijarHoy('2026-11-24');
    const persona1 = await persona('Ana', 'Alvarez');
    await prestamo(persona1.id, '900.00', 3, '2026-10-01', false);

    const informe = await cobranza(db, '2026-11-01', 'PEN');

    expect(informe.exigiblePrestamosCentimos).toBe(30000);
    expect(informe.prestamos[0]?.atrasadoNoAcumuladoCentimos).toBe(30000);
  });

  it('PA-CU21-03 una cuota futura no entra en el exigible del mes', async () => {
    fijarHoy('2026-11-24');
    const persona1 = await persona('Ana', 'Alvarez');
    await prestamo(persona1.id, '1000.00', 1, '2026-12-01', true);

    const informe = await cobranza(db, '2026-11-01', 'PEN');

    expect(informe.exigiblePrestamosCentimos).toBe(0);
    expect(informe.exigibleTotalCentimos).toBe(0);
  });

  it('PA-CU21-04 clasifica la cartera vencida en tramos', async () => {
    fijarHoy('2026-11-24');
    const fechas = ['2026-11-14', '2026-10-15', '2026-09-10', '2026-08-16'];
    const nombres = [
      ['Ana', 'Alvarez'],
      ['Beto', 'Benitez'],
      ['Carla', 'Castillo'],
      ['Diego', 'Diaz'],
    ];
    for (let i = 0; i < fechas.length; i++) {
      const persona1 = await persona(nombres[i][0], nombres[i][1]);
      await prestamo(persona1.id, '1000.00', 1, fechas[i], true);
    }

    const informe = await cobranza(db, '2026-11-01', 'PEN');

    expect(informe.antiguedad['1-30']).toBe(100000);
    expect(informe.antiguedad['31-60']).toBe(100000);
    expect(informe.antiguedad['61-90']).toBe(100000);
    expect(informe.antiguedad.MAS_90).toBe(100000);
    expect(informe.morosos).toHaveLength(4);
  });

  it('PA-CU21-05 un cargo vencido pone a la persona en morosos', async () => {
    fijarHoy('2026-11-24');
    const persona1 = await persona('Ana', 'Alvarez');
    const plataforma = await db.plataformas
      .filter((p) => p.nombre === 'YouTube')
      .first();
    const suscripcion = await crearSuscripcion(db, {
      plataformaId: plataforma!.id,
      nombre: 'YouTube Premium',
      moneda: 'PEN',
      costo: '53.90',
      capacidad: 6,
      diaCobro: 5,
      fechaInicio: '2026-01-01',
    });
    const agregado = await agregarMiembro(db, suscripcion.id, {
      personaId: persona1.id,
      montoAcordado: '15.00',
      fechaInicio: '2026-01-01',
    });
    await db.cargosSuscripcion.add({
      id: nuevoId(),
      miembroId: agregado.miembro.id,
      periodo: '2026-10-01',
      montoCentimos: 1500,
      fechaVencimiento: '2026-11-05',
      estado: 'PENDIENTE',
    });

    const informe = await cobranza(db, '2026-11-01', 'PEN');

    expect(informe.morosos).toHaveLength(1);
    expect(informe.morosos[0]?.personaId).toBe(persona1.id);
    expect(informe.morosos[0]?.saldoCentimos).toBe(1500);
    expect(informe.morosos[0]?.diasMaxAtraso).toBe(19);
    expect(informe.antiguedad['1-30']).toBe(1500);
  });

  it('PA-CU21-06 el CSV coincide con las cifras del informe', async () => {
    fijarHoy('2026-11-24');
    const fechas = ['2026-11-14', '2026-10-15', '2026-09-10', '2026-08-16'];
    const nombres = [
      ['Ana', 'Alvarez'],
      ['Beto', 'Benitez'],
      ['Carla', 'Castillo'],
      ['Diego', 'Diaz'],
    ];
    for (let i = 0; i < fechas.length; i++) {
      const persona1 = await persona(nombres[i][0], nombres[i][1]);
      await prestamo(persona1.id, '1000.00', 1, fechas[i], true);
    }

    const informe = await cobranza(db, '2026-11-01', 'PEN');
    const csv = cobranzaACsv(informe);
    const filas = csv.split('\r\n').slice(1);
    const sumaCsv = filas.reduce((total, fila) => {
      const campos = (fila.match(/"[^"]*"/g) ?? []).map((campo) =>
        campo.slice(1, -1),
      );
      return total + Number(campos[4] ?? 0) * 100;
    }, 0);

    const totalPantalla = Object.values(informe.antiguedad).reduce(
      (a, b) => a + b,
      0,
    );
    expect(filas).toHaveLength(4);
    expect(sumaCsv).toBe(totalPantalla);
    expect(
      informe.morosos.reduce((t, m) => t + m.saldoCentimos, 0),
    ).toBe(totalPantalla);
  });
});
