package pe.qorigo.persona.infrastructure.persistence;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import pe.qorigo.persona.application.DeudaPorMoneda;
import pe.qorigo.persona.application.FichaMovimientos;
import pe.qorigo.persona.application.PagoReciente;
import pe.qorigo.persona.application.PersonaFichaRepository;
import pe.qorigo.persona.application.PrestamoDePersona;
import pe.qorigo.persona.application.SuscripcionDePersona;
import pe.qorigo.shared.domain.Dinero;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Consultas de solo lectura para la ficha de persona. Se calculan en Java a
 * partir de las tablas para mantener el adaptador portable entre PostgreSQL y
 * H2 y evitar vistas específicas de un motor.
 */
@ApplicationScoped
public class PersonaFichaAdapter implements PersonaFichaRepository {

    @Inject
    EntityManager em;

    @Override
    public FichaMovimientos obtener(Long idPersona) {
        return new FichaMovimientos(
                suscripciones(idPersona),
                prestamos(idPersona),
                deuda(idPersona),
                pagosRecientes(idPersona));
    }

    private List<SuscripcionDePersona> suscripciones(Long idPersona) {
        List<?> filas = em.createNativeQuery("""
                        select s.id_suscripcion, s.nombre, pl.nombre, s.moneda, m.estado,
                               m.monto_acordado, m.es_plaza_propia, m.fecha_inicio
                        from miembro_suscripcion m
                        join suscripcion s on s.id_suscripcion = m.id_suscripcion
                        join plataforma pl on pl.id_plataforma = s.id_plataforma
                        where m.id_persona = ?1
                        order by case when m.estado = 'ACTIVO' then 0 else 1 end, s.nombre
                        """)
                .setParameter(1, idPersona)
                .getResultList();
        List<SuscripcionDePersona> resultado = new ArrayList<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            resultado.add(new SuscripcionDePersona(
                    aLong(columnas[0]),
                    (String) columnas[1],
                    (String) columnas[2],
                    aTexto(columnas[3]),
                    (String) columnas[4],
                    aDecimal(columnas[5]),
                    aBoolean(columnas[6]),
                    aFecha(columnas[7])));
        }
        return resultado;
    }

    private List<PrestamoDePersona> prestamos(Long idPersona) {
        List<?> filas = em.createNativeQuery("""
                        select p.id_prestamo, p.moneda, p.capital, p.estado, p.fecha_prestamo
                        from prestamo p
                        where p.id_persona = ?1
                        order by p.fecha_prestamo desc, p.id_prestamo desc
                        """)
                .setParameter(1, idPersona)
                .getResultList();
        List<PrestamoDePersona> resultado = new ArrayList<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            Long idPrestamo = aLong(columnas[0]);
            String estado = (String) columnas[3];
            BigDecimal saldo = "ANULADO".equals(estado) || "CANCELADO".equals(estado)
                    ? Dinero.cero()
                    : saldoPrestamo(idPrestamo);
            resultado.add(new PrestamoDePersona(
                    idPrestamo,
                    aTexto(columnas[1]),
                    aDecimal(columnas[2]),
                    saldo,
                    estado,
                    aFecha(columnas[4])));
        }
        return resultado;
    }

    private BigDecimal saldoPrestamo(Long idPrestamo) {
        BigDecimal programado = aDecimal(em.createNativeQuery("""
                        select coalesce(sum(q.monto_programado), 0)
                        from cuota_prestamo q
                        where q.id_prestamo = ?1 and q.estado in ('PENDIENTE', 'PARCIAL')
                        """)
                .setParameter(1, idPrestamo)
                .getSingleResult());
        BigDecimal aplicado = aDecimal(em.createNativeQuery("""
                        select coalesce(sum(a.monto_aplicado), 0)
                        from aplicacion_pago a
                        join cuota_prestamo q on q.id_cuota = a.id_cuota
                        where q.id_prestamo = ?1
                        """)
                .setParameter(1, idPrestamo)
                .getSingleResult());
        BigDecimal saldo = programado.subtract(aplicado);
        return saldo.signum() <= 0 ? Dinero.cero() : Dinero.normalizar(saldo);
    }

    private List<DeudaPorMoneda> deuda(Long idPersona) {
        Map<String, BigDecimal> cargos = sumasPorMoneda("""
                select s.moneda, sum(c.monto)
                from cargo_suscripcion c
                join miembro_suscripcion m on m.id_miembro = c.id_miembro
                join suscripcion s on s.id_suscripcion = m.id_suscripcion
                where m.id_persona = ?1 and c.estado in ('PENDIENTE', 'PARCIAL')
                group by s.moneda
                """, idPersona);
        Map<String, BigDecimal> cargosAplicados = sumasPorMoneda("""
                select s.moneda, sum(a.monto_aplicado)
                from aplicacion_pago a
                join cargo_suscripcion c on c.id_cargo = a.id_cargo
                join miembro_suscripcion m on m.id_miembro = c.id_miembro
                join suscripcion s on s.id_suscripcion = m.id_suscripcion
                where m.id_persona = ?1 and c.estado in ('PENDIENTE', 'PARCIAL')
                group by s.moneda
                """, idPersona);
        Map<String, BigDecimal> cuotas = sumasPorMoneda("""
                select p.moneda, sum(q.monto_programado)
                from cuota_prestamo q
                join prestamo p on p.id_prestamo = q.id_prestamo
                where p.id_persona = ?1 and p.estado = 'ACTIVO' and q.estado in ('PENDIENTE', 'PARCIAL')
                group by p.moneda
                """, idPersona);
        Map<String, BigDecimal> cuotasAplicadas = sumasPorMoneda("""
                select p.moneda, sum(a.monto_aplicado)
                from aplicacion_pago a
                join cuota_prestamo q on q.id_cuota = a.id_cuota
                join prestamo p on p.id_prestamo = q.id_prestamo
                where p.id_persona = ?1 and p.estado = 'ACTIVO' and q.estado in ('PENDIENTE', 'PARCIAL')
                group by p.moneda
                """, idPersona);

        Map<String, BigDecimal> monedas = new TreeMap<>();
        monedas.putAll(cargos);
        monedas.putAll(cargosAplicados);
        monedas.putAll(cuotas);
        monedas.putAll(cuotasAplicadas);

        Map<String, BigDecimal> deuda = new LinkedHashMap<>();
        for (String moneda : monedas.keySet()) {
            BigDecimal total = cargos.getOrDefault(moneda, BigDecimal.ZERO)
                    .subtract(cargosAplicados.getOrDefault(moneda, BigDecimal.ZERO))
                    .add(cuotas.getOrDefault(moneda, BigDecimal.ZERO))
                    .subtract(cuotasAplicadas.getOrDefault(moneda, BigDecimal.ZERO));
            if (total.signum() > 0) {
                deuda.put(moneda, Dinero.normalizar(total));
            }
        }
        return deuda.entrySet().stream()
                .map(entrada -> new DeudaPorMoneda(entrada.getKey(), entrada.getValue()))
                .toList();
    }

    private Map<String, BigDecimal> sumasPorMoneda(String sql, Long idPersona) {
        List<?> filas = em.createNativeQuery(sql).setParameter(1, idPersona).getResultList();
        Map<String, BigDecimal> resultado = new LinkedHashMap<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            resultado.put(aTexto(columnas[0]), aDecimal(columnas[1]));
        }
        return resultado;
    }

    private List<PagoReciente> pagosRecientes(Long idPersona) {
        Query query = em.createNativeQuery("""
                        select p.id_pago, p.fecha_pago, p.monto, p.moneda, p.metodo_pago, p.estado
                        from pago p
                        where p.id_persona = ?1
                        order by p.fecha_pago desc, p.id_pago desc
                        """)
                .setParameter(1, idPersona);
        query.setMaxResults(5);
        List<?> filas = query.getResultList();
        List<PagoReciente> resultado = new ArrayList<>();
        for (Object fila : filas) {
            Object[] columnas = (Object[]) fila;
            resultado.add(new PagoReciente(
                    aLong(columnas[0]),
                    aInstant(columnas[1]),
                    aDecimal(columnas[2]),
                    aTexto(columnas[3]),
                    (String) columnas[4],
                    (String) columnas[5]));
        }
        return resultado;
    }

    private Long aLong(Object valor) {
        return valor == null ? null : ((Number) valor).longValue();
    }

    private String aTexto(Object valor) {
        return valor == null ? null : valor.toString().trim();
    }

    private BigDecimal aDecimal(Object valor) {
        if (valor == null) {
            return BigDecimal.ZERO;
        }
        if (valor instanceof BigDecimal decimal) {
            return decimal;
        }
        if (valor instanceof Number numero) {
            return new BigDecimal(numero.toString());
        }
        return new BigDecimal(valor.toString());
    }

    private boolean aBoolean(Object valor) {
        if (valor instanceof Boolean booleano) {
            return booleano;
        }
        return valor != null && Boolean.parseBoolean(valor.toString());
    }

    private LocalDate aFecha(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof LocalDate fecha) {
            return fecha;
        }
        if (valor instanceof java.sql.Date fecha) {
            return fecha.toLocalDate();
        }
        if (valor instanceof LocalDateTime fechaHora) {
            return fechaHora.toLocalDate();
        }
        if (valor instanceof OffsetDateTime fechaHora) {
            return fechaHora.toLocalDate();
        }
        return LocalDate.parse(valor.toString());
    }

    private Instant aInstant(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof Instant instante) {
            return instante;
        }
        if (valor instanceof OffsetDateTime fechaHora) {
            return fechaHora.toInstant();
        }
        if (valor instanceof Timestamp marca) {
            return marca.toInstant();
        }
        if (valor instanceof LocalDateTime fechaHora) {
            return fechaHora.atZone(java.time.ZoneId.of("America/Lima")).toInstant();
        }
        return Instant.parse(valor.toString());
    }
}
